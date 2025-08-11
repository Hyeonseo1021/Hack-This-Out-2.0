import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { EC2Client, RunInstancesCommand, TerminateInstancesCommand, DescribeInstancesCommand, _InstanceType as EC2InstanceType } from "@aws-sdk/client-ec2"; 
import Arena from '../models/Arena';
import User from '../models/User';
import Instance from '../models/Instance';
import config from '../config/config';
import Machine from '../models/Machine';
import { Server } from 'http';

const dcTimers = new Map<string, NodeJS.Timeout>();
const gameTimers = new Map<string, NodeJS.Timeout>();

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

      // disconnect grace 타이머 해제
      {
        const key = `${arenaId}:${userId}`;
        const t = dcTimers.get(key);
        if (t) { clearTimeout(t); dcTimers.delete(key); }
      }

      const room = await Arena.findById(arenaId)
        .select('status maxParticipants participants.user participants.hasLeft host')
        .lean();
      if (!room) return socket.emit('arena:join-failed', { reason: '방이 없습니다.' });

      const isListed = (room.participants || []).some(
        (p: any) => String((p.user && p.user._id) ?? p.user) === uid
      );

      if (room.status === 'started') {
        // ▶ 시작 후: 시작 당시 명단에 있는 사람만 재접속 허용
        if (!isListed) {
          return socket.emit('arena:join-failed', { reason: '게임이 이미 시작되었습니다.' });
        }
        // 재접속: 소켓만 방에 다시 참여
        socket.join(arenaId);
        // hasLeft=false로 복구
        await Arena.updateOne(
          { _id: arenaId, 'participants.user': userId },
          { $set: { 'participants.$.hasLeft': false } }
        );
      } else {
        // ▶ 대기중
        if (isListed) {
          // 이미 명단에 있으면 소켓만 조인
          socket.join(arenaId);
        } else {
          // 신규 입장: 정원 체크 (절대 우회 불가)
          const current = room.participants?.length ?? 0;
          if (current >= room.maxParticipants) {
            return socket.emit('arena:join-failed', { reason: '최대 인원을 초과하여 입장할 수 없습니다.' });
          }
          const res = await Arena.updateOne(
            { _id: arenaId, 'participants.user': { $ne: userId }, status: 'waiting' },
            { $push: { participants: { user: userId, isReady: false, hasLeft: false } } }
          );
          if (res.modifiedCount === 0) {
            return socket.emit('arena:join-failed', { reason: '입장할 수 없습니다.' });
          }
          socket.join(arenaId);
        }
      }

      // 방송
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
          hasLeft: !!pp.hasLeft,
          publicIp: pp.publicIp ?? null,
          instanceId: pp.instanceId ?? null,
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
    const arena = await Arena.findById(arenaId).populate('machine');
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

    try {
      const machine: any = (arena as any).machine;
      if (!machine?.amiId) {
        return socket.emit('arena:start-failed', { reason: 'Missing machine AMI info.'});
      }

      for (const p of arena.participants) {
        if (p.instanceId) continue;

        const runParams: any = {
          ImageId: machine.amiId,
          InstanceType: (machine.InstanceType as any) || 't2.micro',
          MinCount: 1,
          MaxCount: 1,
        };

        if (config.aws.privateSubnetId) {
          runParams.NetworkInterfaces = [{
            DeviceIndex: 0,
            SubnetId: config.aws.privateSubnetId,
            Groups: [config.aws.securityGroupId],
            AssociatePublicIpAddress: false,
          }];
        } else {
          runParams.securityGroupIds = [config.aws.securityGroupId!];
        }

        const out = await ec2Client.send(new RunInstancesCommand(runParams));
        const inst = out.Instances?.[0];
        p.instanceId = inst?.InstanceId || null;

        let privateIp: string | null = inst?.PrivateIpAddress ?? null;
        for (let i = 0; i < 3 &&  !privateIp && p.instanceId; i++) {
          await new Promise(r => setTimeout(r, 1500));
          const desc = await ec2Client.send(new DescribeInstancesCommand({
            InstanceIds: [String(p.instanceId)],
          }));
          privateIp = desc.Reservations?.[0]?.Instances?.[0]?.PrivateIpAddress || null;
        }
        (p as any).vpnIp = privateIp ?? null;

        const uid = String((p.user as any)?._id ?? p.user);
        await Instance.create({
          user: uid,
          machineType: machine._id,
          arena: arenaId,
          instanceId: p.instanceId,
          vpnIp: (p as any).vpnIp,
          status: 'pending',
        });
      }

      await arena.save();
    } catch (e) {
      console.error('[arena start - spawn', e);
    }

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
        hasLeft: !!pp.hasLeft,
        instanceId: pp.instanceId ?? null,
        vpnIp: pp.vpnIp ?? null,
      })),
    });

    io.to(arenaId).emit('arena:start', {
      arenaId,
      startTime: arena.startTime,
      endTime: arena.endTime,
    });

    const msLeft = Math.max(0, arena.endTime.getTime() - Date.now());
    if (gameTimers.has(arenaId)) clearTimeout(gameTimers.get(arenaId)!);
    gameTimers.set(arenaId, setTimeout(() => {
      gameTimers.delete(arenaId);
      endArena(arenaId, io);
    }, msLeft));
   });

  socket.on('arena:leave', async ({ arenaId, userId }) => {
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      const uid = String(userId);
      const wasHost = String(arena.host) === uid;

      if (arena.status === 'waiting') {
        // 대기중: 완전 제거 + (대기중일 때만) 호스트 승계
        await Arena.updateOne(
          { _id: arenaId },
          { $pull: { participants: { user: userId } } }
        );

        if (wasHost) {
          const after = await Arena.findById(arenaId);
          if (after) {
            const next = after.participants[0]?.user;
            if (next) { after.host = (next as any)?._id ?? next; await after.save(); }
          }
        }
      } else {
        // 시작/종료: 명단 유지, hasLeft만 표시
        await Arena.updateOne(
          { _id: arenaId, 'participants.user': userId },
          { $set: { 'participants.$.hasLeft': true } }
        );
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
          hasLeft: !!pp.hasLeft,        // ✅ 포함
          publicIp: pp.publicIp ?? null,
          instanceId: pp.instanceId ?? null,
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
          participants: (room.participants || []).map((p: any) => ({
            user: String((p.user && (p.user as any)._id) ?? p.user),
          })),
        });
      }

      // ✅ 대기중일 때만 방 비우기 체크
      if (arena.status === 'waiting') {
        await deleteArenaIfEmpty(String(userId), io);
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
        const arena = await Arena.findById(arenaId);
        if (! arena) return;

        if (arena.status === 'waiting') {
        await Arena.updateOne(
          { _id: arenaId, 'participants.user': userId },
          { $set: { 'participants.$.hasLeft': true } }
        );
      } else {
        await Arena.updateOne({ _id: arenaId }, { $pull: { participants: { user: userId } } });
        if (String(arena.host) === String(userId)) {
          const after = await Arena.findById(arenaId);
          if (after) {
            const next = after.participants[0]?.user;
            if (next) { after.host = (next as any)?._id ?? next; await after.save(); }
          }
        }
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
            user: pp.user, 
            isReady: !!pp.isReady,
            hasLeft: !!pp.hasLeft,
            instanceId: pp.instanceId ?? null,
            vpnIp: pp.vpnIp ?? null,
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

        if (arena.status === 'waiting') {
          await deleteArenaIfEmpty(String(userId), io);
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
      // ✅ 시작/종료 방은 손대지 않음
      if (arena.status !== 'waiting') continue;

      arena.participants = arena.participants.filter(p => p.user.toString() !== userId);

      if (arena.participants.length === 0) {
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
    // ✅ 1) 시작 때 걸어둔 종료 타이머 정리
    const t = gameTimers.get(arenaId);
    if (t) { clearTimeout(t); gameTimers.delete(arenaId); }

    const arena = await Arena.findById(arenaId);
    if (!arena || arena.status === 'ended') return;

    arena.status = 'ended';
    arena.endTime = new Date();
    await arena.save();

    // ✅ 2) 종료 스냅샷 먼저 방송(프론트가 즉시 상태 전환 가능)
    const populated = await Arena.findById(arenaId)
      .populate('participants.user', '_id username')
      .lean();

    io.to(arenaId).emit('arena:update', {
      arenaId: String(populated?._id || arenaId),
      status: 'ended',
      host: String((populated?.host as any)?._id ?? populated?.host ?? ''),
      startTime: populated?.startTime || null,
      endTime: populated?.endTime || null,
      participants: (populated?.participants || []).map((pp: any) => ({
        user: pp.user,
        isReady: !!pp.isReady,
        hasLeft: !!pp.hasLeft,
        instanceId: pp.instanceId ?? null,
        vpnIp: pp.vpnIp ?? null,
      })),
    });

    // (옵션) 별도 끝났음 이벤트도 유지
    io.to(arenaId).emit('arena:ended', { endTime: arena.endTime });

    // ✅ 3) EC2 인스턴스 종료(실패해도 다른 것 계속 진행)
    await Promise.allSettled(
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

    // ✅ 4) Instance 컬렉션 정리
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
  