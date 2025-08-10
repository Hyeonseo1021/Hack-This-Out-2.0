import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { EC2Client, RunInstancesCommand, TerminateInstancesCommand, _InstanceType as EC2InstanceType } from "@aws-sdk/client-ec2"; 
import Arena from '../models/Arena';
import User from '../models/User';
import Instance from '../models/Instance';
import config from '../config/config';
import Machine from '../models/Machine';
import { Server } from 'http';

const dcTimers = new Map<string, NodeJS.Timeout>();

const ec2Client = new EC2Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId!,
    secretAccessKey: config.aws.secretAccessKey!,
  },
});

export const registerArenaSocketHandlers = (socket, io) => {
  socket.on('arena:join', async ({ arenaId, userId }) => {
    try {
      const uid = String(userId);
      (socket as any).userId = uid;
      (socket as any).arenaId = String(arenaId);

      {
        const key = `${arenaId}:${userId}`;
        const t = dcTimers.get(key);
        if (t) { clearTimeout(t); dcTimers.delete(key); }
      }

      // 1) 방 존재/상태 확인
      const room = await Arena.findById(arenaId).select('status maxParticipants participants.user host');
      if (!room) return socket.emit('arena:join-failed', { reason: '방이 없습니다.' });

      // 2) 이미 참가 중이면 그냥 소켓만 room에 join (중복 push 방지)
      if (room.participants.some(p => String((p.user as any)?._id ?? p.user) === uid)) {
        socket.join(arenaId);
      } else {
        // 3) 원자적 조인: 정원 미만 & 대기중 & 아직 미참여일 때만 push
        const res = await Arena.updateOne(
          {
            _id: arenaId,
            status: 'waiting',
            'participants.user': { $ne: userId },
            $expr: { $lt: [ { $size: '$participants' }, '$maxParticipants' ] }
          },
          { $push: { participants: { user: userId, isReady: false } } }
        );

        if (res.modifiedCount === 0) {
          return socket.emit('arena:join-failed', { reason: '최대 인원을 초과하여 입장할 수 없습니다.' });
        }
        socket.join(arenaId);
      }

      // 4) 방송 (방 내부 + 목록)
      const populated = await Arena.findById(arenaId)
        .populate('participants.user', '_id username')
        .lean();

      io.to(arenaId).emit('arena:update', {
        arenaId: String(populated?._id || arenaId),
        status: populated?.status || 'waiting',
        host: String((populated?.host as any)?._id ?? populated?.host ?? ''),
        startTime: populated?.startTime || null,
        endTime: populated?.endTime || null,
        participants: (populated?.participants || []).map((pp: any) => ({
          user: pp.user,
          isReady: !!pp.isReady,
        })),
      });

      const summary = await Arena.findById(arenaId)
        .select('name category status maxParticipants participants.user')
        .lean();

      if (summary) {
        io.emit('arena:room-updated', {
          _id: String(summary._id),
          name: summary.name,
          category: summary.category,
          status: summary.status,
          maxParticipants: summary.maxParticipants,
          participants: (summary.participants || []).map((p: any) => ({
            user: String((p.user && (p.user as any)._id) ?? p.user),
          })),
        });
      }
    } catch (e) {
      console.error('[arena:join] error:', e);
      socket.emit('arena:join-failed', { reason: '입장 중 오류가 발생했습니다.' });
    }
  });

  // ready 토글
  socket.on('arena:ready', async ({
    arenaId,
    userId,
    ready,
  }: { arenaId: string; userId: string; ready: boolean }) => {
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      // 대기중에만 준비 변경
      if (arena.status !== 'waiting') {
        return socket.emit('arena:ready-failed', { reason: '대기 중에만 준비를 변경할 수 있습니다.' });
      }

      const uid = String(userId);
      const p = arena.participants.find(x => String((x.user as any)?._id ?? x.user) === uid && !x.hasLeft);
      if (!p) {
        return socket.emit('arena:ready-failed', { reason: '참가자가 아닙니다.' });
      }

      p.isReady = !!ready;

      await arena.save();

      // 저장 후 다시 읽어 populate 해서 방송(항상 username 포함)
      const populated = await Arena.findById(arenaId)
        .populate('participants.user', '_id username')
        .lean();

      io.to(arenaId).emit('arena:update', {
        arenaId: String(populated?._id || arenaId),
        status: populated?.status || 'waiting',
        host: String((populated?.host as any)?._id ?? populated?.host ?? ''),
        startTime: populated?.startTime || null,
        endTime: populated?.endTime || null,
        participants: (populated?.participants || []).map((pp: any) => ({
          user: pp.user, // {_id, username}
          isReady: !!pp.isReady,
          hasLeft: !!pp.hasLeft,
          publicIp: pp.publicIp ?? null,
          instanceId: pp.instanceId ?? null,
        })),
      });
    } catch (e) {
      console.error('[arena:ready] error:', e);
      socket.emit('arena:ready-failed', { reason: '준비 상태 변경 중 오류가 발생했습니다.' });
    }
  });

  socket.on('arena:start', async ({ arenaId, userId }) => {
    const arena = await Arena.findById(arenaId);
    if (!arena) return;

    const hostStr = String(arena.host);
    if (hostStr !== String(userId)) {
      return socket.emit('arena:start-failed', { reason: '호스트만 시작할 수 있습니다.' });
    }
    if (arena.status !== 'waiting') {
      return socket.emit('arena:start-failed', { reason: '이미 시작되었거나 종료된 방입니다.' });
    }

    // 최소 2명(호스트 + 1)
    if ((arena.participants || []).length < 2) {
      return socket.emit('arena:start-failed', { reason: '최소 2명이 필요합니다.' });
    }

    // 호스트 제외 전원 준비
    const others = (arena.participants || []).filter(p => {
      const uid = String((p.user as any)?._id ?? p.user);
      return uid !== hostStr;
    });
    const everyoneElseReady = others.length > 0 && others.every(p => !!p.isReady);
    if (!everyoneElseReady) {
      return socket.emit('arena:start-failed', { reason: '호스트 제외 전원이 준비되지 않았습니다.' });
    }

    // 시작 처리
    arena.status = 'started';
    arena.startTime = new Date();
    arena.endTime = new Date(arena.startTime.getTime() + arena.duration * 60000);
    await arena.save();

    // 방 내부 업데이트 + 시작 이벤트
    const populated = await Arena.findById(arenaId)
      .populate('participants.user', '_id username')
      .lean();

    io.to(arenaId).emit('arena:update', {
      arenaId: String(populated?._id || arenaId),
      status: populated?.status || 'started',
      host: String((populated?.host as any)?._id ?? populated?.host ?? ''),
      startTime: populated?.startTime || null,
      endTime: populated?.endTime || null,
      participants: (populated?.participants || []).map((pp: any) => ({
        user: pp.user,
        isReady: !!pp.isReady,
      })),
    });

    io.to(arenaId).emit('arena:start', {
      arenaId,
      startTime: arena.startTime,
      endTime: arena.endTime,
    });
  });

  socket.on('arena:leave', async ({ arenaId, userId }) => {
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      const uid = String(userId);
      const wasHost = String(arena.host) === uid;

      // 참가자 배열에서 아예 제거
      await Arena.updateOne(
        { _id: arenaId },
        { $pull: { participants: { user: userId } } } // 문자열도 Mongoose가 ObjectId로 캐스팅
      );

      // 호스트가 나갔으면 승계
      if (wasHost) {
        const after = await Arena.findById(arenaId);
        if (after) {
          const next = after.participants[0]?.user; // 남은 첫 참가자
          if (next) {
            after.host = (next as any)?._id ?? next;
            await after.save();
          }
        }
      }

      socket.leave(arenaId);

      // 방 내부 업데이트(이름 보이도록 populate)
      const populated = await Arena.findById(arenaId)
        .populate('participants.user', '_id username')
        .lean();

      io.to(arenaId).emit('arena:update', {
        arenaId: String(populated?._id || arenaId),
        status: populated?.status || 'waiting',
        host: String((populated?.host as any)?._id ?? populated?.host ?? ''),
        startTime: populated?.startTime || null,
        endTime: populated?.endTime || null,
        participants: (populated?.participants || []).map((pp: any) => ({
          user: pp.user,
          isReady: !!pp.isReady,
          // ← 이제 hasLeft는 쓰지 않음(배열에서 제거했으니까)
        })),
      });

      // 목록 페이지 갱신(전역)
      const room = await Arena.findById(arenaId)
        .select('name category status maxParticipants participants.user')
        .lean();

      if (room) {
        io.emit('arena:room-updated', {
          _id: String(room._id),
          name: room.name,
          category: room.category,
          status: room.status,
          maxParticipants: room.maxParticipants,
          // 남아있는 참가자만 전송
          participants: (room.participants || []).map((p: any) => ({
            user: String((p.user && (p.user as any)._id) ?? p.user),
          })),
        });
      }
    } catch (e) {
      console.error('[arena:leave] error:', e);
    }
  });

  socket.on('disconnect', () => {
    const arenaId = (socket as any).arenaId;
    const userId  = (socket as any).userId;
    if (!arenaId || !userId) return;

    const key = `${arenaId}:${userId}`;
    if (dcTimers.has(key)) return; // 중복 방지

    const timer = setTimeout(async () => {
      dcTimers.delete(key);
      try {
        // 여기서 $pull + (필요 시) 호스트 승계 + 방 내부/목록 브로드캐스트
        await Arena.updateOne({ _id: arenaId }, { $pull: { participants: { user: userId } } });

        const after = await Arena.findById(arenaId);
        if (after && String(after.host) === String(userId)) {
          const next = after.participants[0]?.user;
          if (next) { after.host = (next as any)?._id ?? next; await after.save(); }
        }

        const populated = await Arena.findById(arenaId)
          .populate('participants.user', '_id username').lean();

        io.to(arenaId).emit('arena:update', {
          arenaId: String(populated?._id || arenaId),
          status: populated?.status || 'waiting',
          host: String((populated?.host as any)?._id ?? populated?.host ?? ''),
          startTime: populated?.startTime || null,
          endTime: populated?.endTime || null,
          participants: (populated?.participants || []).map((pp: any) => ({
            user: pp.user, isReady: !!pp.isReady,
          })),
        });

        const room = await Arena.findById(arenaId)
          .select('name category status maxParticipants participants.user').lean();

        if (room) {
          io.emit('arena:room-updated', {
            _id: String(room._id),
            name: room.name,
            category: room.category,
            status: room.status,
            maxParticipants: room.maxParticipants,
            participants: (room.participants || []).map((p: any) => ({
              user: String((p.user && (p.user as any)._id) ?? p.user),
            })),
          });
        }
      } catch (e) {
        console.error('[disconnect grace] error:', e);
      }
    }, 3000);

    dcTimers.set(key, timer);
  });


  // 서버 socket 파일에 추가
  socket.on('arena:sync', async ({ arenaId }) => {
    try {
      const populated = await Arena.findById(arenaId)
        .populate('participants.user', '_id username')
        .lean();
      if (!populated) return;

      // 요청한 소켓에게만 최신 상태 푸시
      socket.emit('arena:update', {
        arenaId: String(populated._id),
        status: populated.status || 'waiting',
        host: String((populated.host as any)?._id ?? populated.host ?? ''),
        startTime: populated.startTime || null,
        endTime: populated.endTime || null,
        participants: (populated.participants || []).map((pp: any) => ({
          user: pp.user,          // {_id, username}
          isReady: !!pp.isReady,
        })),
      });
    } catch (e) {
      console.error('[arena:sync] error:', e);
    }
  });
};

export const emitRoomSummary = async (io: Server, arenaId: string) => {
  const room = await Arena.findById(arenaId)
    .select('name category maxParticipants participants.user participants.hasLeft')
    .lean();
  if (!room) return;

  io.emit('arena:room-updated', {
    _id: String(room._id),
    name: room.name,
    category: room.category,
    status: room.status,
    maxParticipants: room.maxParticipants,
    participants: (room.participants || []).map((p: any) => ({
      user: String((p.user && (p.user as any)._id) ?? p.user),
      hasLeft: !!p.hasLeft,
    })),
  });
};

// 나중에 difficulty 추가
export const createArena = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData?.id;
    if (!userId) {
      res.status(401).json({ msg: 'Unauthorized' });
      return;
    }

    const { name, category,  maxParticipants, duration } = req.body;
    if (!name || !category || !maxParticipants || !duration) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    const candidate = await Machine.aggregate([
      { $match: { category, isBattleOnly: true } },
      { $sample: { size: 1 } }
    ]);

    if (candidate.length === 0) {
      res.status(404).json({ message: 'No suitable arena machine found.' });
      return;
    }

    const machine = candidate[0]

    const newArena = await Arena.create({
      name, 
      host: userId,
      category, 
      maxParticipants,
      duration,
      machine: machine._id,
      participants: [{ user: userId, isReady: false, hasLeft: false }],
      status: 'waiting'
    });

    req.app.get('io')?.emit('arena:new-room', newArena);
    res.status(201).json(newArena)

  } catch (err) {
    console.error('Create arena error:', err);
    res.status(500).json({ message: 'Internal server error'});
  }
};

export const getArenaList = async (req: Request, res: Response): Promise<void> => {
  try {
    const arenas = await Arena.find()
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(arenas);
  } catch (err) {
    console.error('Failed to fetch arenas:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getArenaById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { arenaId } = req.params;
    const arena = await Arena.findById(String(arenaId))
      .populate('participants.user', 'username');

    if (!arena) {
      res.status(404).json({ message: 'Arena not found' });
      return;
    }
 
    res.json(arena);
  } catch (err) {
    console.error('getArenaById error:', err);
    res.status(500).json({ message: 'Failed to fetch arena' });
  }
};


export const deleteArenaIfEmpty = async (userId: string, io: any) => {
  try {
    const arenas = await Arena.find({ 'participants.user': userId }) as any;

    for (const arena of arenas) {
      arena.participants = arena.participants.filter(p => p.user.toString() !== userId);

      if (arena.participants.length === 0 && arena.status === 'waiting') {
        await Arena.deleteOne({ _id: arena._id });
        io.emit('arena:deleted', { arenaId: arena._id });
      } else {
        await arena.save();
        const populatedArena = await Arena.findById(arena._id).populate('participants.user', 'username');
        io.to(arena._id.toString()).emit('arena:update-participants', populatedArena.participants);
      }
    }
  } catch (err) {
    console.error('deleteArenaIfEmpty error:', err);
  }
};


export const endArena = async (arenaId: string, io: any) => {
  try {
    const arena = await Arena.findById(arenaId);
    if (!arena || arena.status === 'ended') return;

    arena.status = 'ended';
    arena.endTime = new Date();
    await arena.save();

    io.to(arenaId).emit('arena:ended', {
      endTime: arena.endTime,
    });

    // ✅ EC2 인스턴스 종료
    await Promise.all(
      arena.participants.map(async (p) => {
        if (!p.instanceId) return;
        try {
          const terminateCommand = new TerminateInstancesCommand({
            InstanceIds: [p.instanceId],
          });
          await ec2Client.send(terminateCommand);
        } catch (err) {
          console.warn(`[인스턴스 종료 실패] ${p.instanceId}:`, err);
        }
      })
    );

    // ✅ (선택) Instance DB 정리
    await Instance.deleteMany({ arena: arenaId });

  } catch (err) {
    console.error('endArena error:', err);
  }
};

export const submitFlagArena = async (req: Request, res: Response): Promise<void> => {
  try {
    const { arenaId } = req.params;
    const { flag, machineId } = req.body;
    const userId = res.locals.jwtData?.id;

    if (!arenaId || !userId || !machineId || !flag) {
      res.status(400).json({ msg: '필수 정보 누락됨.' });
      return;
    }

    const arena = await Arena.findById(arenaId);
    if (!arenaId) {
      res.status(404).json({ msg: 'Arena not found.'});
      return;
    }

    const machine = await Machine.findById(machineId);
    if (!machine) {
      res.status(404).json({ msg: 'Machine not found.' });
      return;
    }

    const alreadySubmitted = arena.submissions.find(
      (sub) => sub.user.toString() === userId
    );
    if (alreadySubmitted) {
      res.status(400).json({ msg: '이미 제출한 사용자입니다.' });
      return;
    }
    const isMatch = await bcrypt.compare(flag, machine.flag);
    if (!isMatch) {
      // 틀린 경우에도 submissions에 기록할 수 있음
      arena.submissions.push({
        user: userId,
        submitttedAt: new Date(),
        flagCorrect: false
      });
      await arena.save();

      res.status(400).json({ msg: 'Incorrect flag.' });
      return;
    }

    // 4. 정답 제출 저장
    arena.submissions.push({
      user: userId,
      submitttedAt: new Date(),
      flagCorrect: true
    });
    await arena.save();

    // 5. 유저 경험치 지급
    const user = await User.findById(userId);
    if (user) {
      user.exp += arena.arenaExp;
      await (user as any).updateLevel();
      await user.save();
    }

    // 6. 응답 반환
    res.status(200).json({
      msg: '정답입니다!',
      correct: true,
      expEarned: arena.arenaExp,
      totalExp: user?.exp || 0
    });

    // 7. 모든 유저가 정답 제출했는지 확인 → arena 종료 emit
    const totalParticipants = arena.participants.filter(p => !p.hasLeft).length;
    const correctSubmissions = arena.submissions.filter(s => s.flagCorrect).length;

    if (correctSubmissions >= totalParticipants) {
      const io = req.app.get('io'); // socket.io 등록되어 있어야 함
      io.to(arenaId).emit('arena:ended');
    }

    } catch (error) {
      console.error('Arena flag 제출 중 오류:', error);
      res.status(500).json({ msg: 'Arena flag 제출 실패' });
    }
  };
  