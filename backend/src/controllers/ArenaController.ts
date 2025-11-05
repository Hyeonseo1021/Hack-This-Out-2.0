import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { EC2Client, RunInstancesCommand, TerminateInstancesCommand, DescribeInstancesCommand, _InstanceType as EC2InstanceType } from "@aws-sdk/client-ec2"; 
import Arena from '../models/Arena';
import User from '../models/User';
import Instance from '../models/Instance';
import config from '../config/config';
import Machine from '../models/Machine';
import ArenaProcess from '../models/ArenaProcess';
import { Server } from 'http';

// ✅ 수정: unused import 제거
// import { start } from 'repl';

const dcTimers = new Map<string, NodeJS.Timeout>();
const gameTimers = new Map<string, NodeJS.Timeout>();

const ec2Client = new EC2Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId!,
    secretAccessKey: config.aws.secretAccessKey!,
  },
});

export const scheduleEnd = (arenaId: string, endAt: Date, io: any) => {
  const old = gameTimers.get(arenaId);
  if (old) clearTimeout(old);

  const ms = Math.max(0, endAt.getTime() - Date.now());
  const t = setTimeout(async () => {
    await endArena(arenaId, io);
    gameTimers.delete(arenaId);
  }, ms);

  gameTimers.set(arenaId, t);
};

// ✅ 수정: timer cleanup 함수 추가
export const cleanupTimers = (arenaId: string) => {
  const gameTimer = gameTimers.get(arenaId);
  if (gameTimer) {
    clearTimeout(gameTimer);
    gameTimers.delete(arenaId);
  }
  
  // arenaId로 시작하는 모든 disconnect timer 정리
  for (const [key, timer] of dcTimers.entries()) {
    if (key.startsWith(`${arenaId}:`)) {
      clearTimeout(timer);
      dcTimers.delete(key);
    }
  }
};

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
          // ✅ 수정: 원자적 정원 체크 - Race Condition 방지
          const res = await Arena.updateOne(
            { 
              _id: arenaId, 
              'participants.user': { $ne: userId }, 
              status: 'waiting',
              $expr: { $lt: [{ $size: "$participants" }, "$maxParticipants"] }
            },
            { $push: { participants: { user: userId, isReady: false, hasLeft: false } } }
          );
          if (res.modifiedCount === 0) {
            return socket.emit('arena:join-failed', { reason: '입장할 수 없습니다. (정원 초과 또는 이미 입장함)' });
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
        problemInstanceId: populated?.problemInstanceId || null,
        problemInstanceIp: populated?.problemInstanceIp || null,
        participants: (populated?.participants || []).map((pp: any) => ({
          user: pp.user,
          isReady: !!pp.isReady,
          hasLeft: !!pp.hasLeft,
          vpnIp: pp.vpnIp ?? null,
          status: pp.status || 'waiting',
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
        problemInstanceId: populated?.problemInstanceId || null,
        problemInstanceIp: populated?.problemInstanceIp || null,
        participants: (populated?.participants || []).map((pp: any) => ({
          user: pp.user,
          isReady: !!pp.isReady,
          hasLeft: !!pp.hasLeft,
          vpnIp: pp.vpnIp ?? null,
          status: pp.status || 'waiting',
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

    if ((arena.participants || []).length < 2) {
      return socket.emit('arena:start-failed', { reason: '최소 2명이 필요합니다.' });
    }

    const others = (arena.participants || []).filter(p => {
      const uid = String((p.user as any)?._id ?? p.user);
      return uid !== hostStr;
    });
    const everyoneElseReady = others.length > 0 && others.every(p => !!p.isReady);
    if (!everyoneElseReady) {
      return socket.emit('arena:start-failed', { reason: '호스트 제외 전원이 준비되지 않았습니다.' });
    }

    arena.status = 'started';
    arena.startTime = new Date();
    arena.endTime = new Date(arena.startTime.getTime() + arena.duration * 60000);

    try {
      const machine: any = (arena as any).machine;
      if (!machine?.amiId) {
        return socket.emit('arena:start-failed', { reason: 'Missing machine AMI info.'});
      }

      // 문제 머신이 없으면 생성 (한 번만)
      if (!arena.problemInstanceId) {
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
          runParams.SecurityGroupIds = [config.aws.securityGroupId!];
        }

        const out = await ec2Client.send(new RunInstancesCommand(runParams));
        const inst = out.Instances?.[0];
        arena.problemInstanceId = inst?.InstanceId || null;

        // ✅ 수정: IP 대기 로직 개선
        let problemIp: string | null = inst?.PrivateIpAddress ?? null;
        
        // IP가 없을 때만 재시도
        if (!problemIp && arena.problemInstanceId) {
          console.log('[arena:start] Waiting for problem instance IP...');
          
          for (let i = 0; i < 5 && !problemIp; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const desc = await ec2Client.send(new DescribeInstancesCommand({
              InstanceIds: [String(arena.problemInstanceId)],
            }));
            problemIp = desc.Reservations?.[0]?.Instances?.[0]?.PrivateIpAddress || null;
            
            if (problemIp) {
              console.log('[arena:start] Got problem instance IP:', problemIp);
              break;
            }
          }
          
          // ✅ 수정: IP를 받지 못한 경우 경고
          if (!problemIp) {
            console.error('[arena:start] Failed to get problem instance IP after retries');
            // 계속 진행하되 나중에 문제가 될 수 있음을 로그에 남김
          }
        }
        
        arena.problemInstanceIp = problemIp;
      }

      // 모든 참가자를 VPN 연결 대기 상태로 변경
      for (const p of arena.participants.filter(x => !x.hasLeft)) {
        (p as any).status = 'vpn_connecting';
        p.vpnIp = null; // VPN IP 초기화
      }

      await arena.save();
      
      // ✅ 수정: endTime이 있을 때만 스케줄링
      if (arena.endTime) {
        scheduleEnd(String(arena._id), arena.endTime, io);
      } else {
        console.error('[arena:start] endTime is null, cannot schedule end');
      }

    } catch (e) {
      console.error('[arena start - problem machine creation]', e);
      return socket.emit('arena:start-failed', { reason: '문제 인스턴스 생성 실패' });
    }

    // 업데이트 브로드캐스트
    const populated = await Arena.findById(arenaId)
      .populate('participants.user', '_id username')
      .lean();

    io.to(arenaId).emit('arena:update', {
      arenaId: String(populated?._id || arenaId),
      status: 'started',
      host: String((populated?.host as any)?._id ?? populated?.host ?? ''),
      startTime: populated?.startTime || null,
      endTime: populated?.endTime || null,
      problemInstanceId: populated?.problemInstanceId || null,
      problemInstanceIp: populated?.problemInstanceIp || null,
      participants: (populated?.participants || []).map((pp: any) => ({
        user: pp.user,
        isReady: !!pp.isReady,
        hasLeft: !!pp.hasLeft,
        vpnIp: pp.vpnIp ?? null,
        status: pp.status || 'vpn_connecting',
      })),
    });

    io.to(arenaId).emit('arena:start', {
      arenaId,
      startTime: arena.startTime,
      endTime: arena.endTime,
      needVpnConnection: true,
    });
  });

  socket.on('arena:leave', async ({ arenaId, userId }) => {
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      const uid = String(userId);
      const wasHost = String(arena.host) === uid;

      if (arena.status === 'waiting') {
        // 대기중: 완전 제거 + 호스트 승계
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
        problemInstanceId: populated?.problemInstanceId || null,
        problemInstanceIp: populated?.problemInstanceIp || null,
        participants: (populated?.participants || []).map((pp: any) => ({
          user: pp.user,
          isReady: !!pp.isReady,
          hasLeft: !!pp.hasLeft,
          vpnIp: pp.vpnIp ?? null,
          status: pp.status || 'waiting',
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
        await deleteArenaIfEmpty(arenaId, io);
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
        if (!arena) return;

        // ✅ 수정: arena:leave와 로직 일치시킴
        if (arena.status === 'waiting') {
          // 대기중: 완전 제거 + 호스트 승계
          await Arena.updateOne(
            { _id: arenaId },
            { $pull: { participants: { user: userId } } }
          );
          
          if (String(arena.host) === String(userId)) {
            const after = await Arena.findById(arenaId);
            if (after) {
              const next = after.participants[0]?.user;
              if (next) { 
                after.host = (next as any)?._id ?? next; 
                await after.save(); 
              }
            }
          }
        } else {
          // 시작/종료: 명단 유지, hasLeft만 표시
          await Arena.updateOne(
            { _id: arenaId, 'participants.user': userId },
            { $set: { 'participants.$.hasLeft': true } }
          );
        }

        const populated = await Arena.findById(arenaId)
          .populate('participants.user', '_id username').lean();

        io.to(arenaId).emit('arena:update', {
          arenaId: String(populated?._id || arenaId),
          status: populated?.status || 'waiting',
          host: String((populated?.host as any)?._id ?? populated?.host ?? ''),
          startTime: populated?.startTime || null,
          endTime: populated?.endTime || null,
          problemInstanceId: populated?.problemInstanceId || null,
          problemInstanceIp: populated?.problemInstanceIp || null,
          participants: (populated?.participants || []).map((pp: any) => ({
            user: pp.user,
            isReady: !!pp.isReady,
            hasLeft: !!pp.hasLeft,
            vpnIp: pp.vpnIp ?? null,
            status: pp.status || 'waiting',
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
          await deleteArenaIfEmpty(arenaId, io);
        }
      } catch (e) {
        console.error('[disconnect grace] error:', e);
      }
    }, 3000);

    dcTimers.set(key, timer);
  });

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
        problemInstanceId: populated.problemInstanceId || null,
        problemInstanceIp: populated.problemInstanceIp || null,
        participants: (populated.participants || []).map((pp: any) => ({
          user: pp.user,
          isReady: !!pp.isReady,
          hasLeft: !!pp.hasLeft,
          vpnIp: pp.vpnIp ?? null,
          status: pp.status || 'waiting',
        })),
      });
    } catch (e) {
      console.error('[arena:sync] error:', e);
    }
  });
};

export const createArena = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData?.id;
    if (!userId) {
      res.status(401).json({ msg: 'Unauthorized' });
      return;
    }

    const { name, machineId, maxParticipants, duration } = req.body;
    if (!name || !machineId || !maxParticipants || !duration) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    if (name.length > 30) {
      res.status(400).json({ message: 'Arena name must be 30 characters or fewer.' });
      return;
    }

    // 선택된 머신이 존재하고 활성화되어 있는지 확인
    const machine = await Machine.findOne({ _id: machineId, isActive: true });
    if (!machine) {
      res.status(404).json({ message: 'Selected machine not found or inactive.' });
      return;
    }

    const newArena = await Arena.create({
      name, 
      host: userId,
      category: machine.category,
      maxParticipants,
      duration,
      machine: machine._id,
      participants: [{ user: userId, isReady: false, hasLeft: false }],
      status: 'waiting'
    });

    req.app.get('io')?.emit('arena:new-room', newArena);
    res.status(201).json(newArena);

  } catch (err) {
    console.error('Create arena error:', err);
    res.status(500).json({ message: 'Internal server error'});
  }
};

export const getArenaList = async (req: Request, res: Response): Promise<void> => {
  try {
    const arenas = await Arena.find({
      status: { $in: ['waiting', 'started'] }
    })
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

// ✅ 수정: 로직 단순화 및 명확화
export const deleteArenaIfEmpty = async (arenaId: string, io: any) => {
  try {
    const arena = await Arena.findById(arenaId);
    
    if (!arena) return;
    
    // 대기중 방만 처리
    if (arena.status !== 'waiting') return;
    
    // 참가자가 없으면 삭제
    if (arena.participants.length === 0) {
      await Arena.deleteOne({ _id: arenaId });
      io.emit('arena:deleted', { arenaId });
      console.log(`[deleteArenaIfEmpty] Arena ${arenaId} deleted (empty)`);
    }
  } catch (err) {
    console.error('deleteArenaIfEmpty error:', err);
  }
};

export const endArena = async (arenaId: string, io: any) => {
  try {
    const arena = await Arena.findById(arenaId);
    if (!arena) return console.error('Arena not found.');

    arena.status = 'ended';
    await arena.save();

    const instanceIds = arena.participants.map((p: any) => p.instanceId).filter((id: string) => !!id);
    if (instanceIds.length > 0) {
      await ec2Client.send(new TerminateInstancesCommand({ InstanceIds: instanceIds }));
      console.log(`✅ Terminated ${instanceIds.length} instances for arena ${arenaId}`);
    }

    await ArenaProcess.create({
      arenaId: arena._id,
      machine: arena.machine,
      participants: arena.participants.map((p: any) => ({
        user: p.user,
        isWinner: p.hasFlagSubmitted ?? false,
        expEarned: p.expEarned ?? 0,
        timeTaken: p.timeTaken ?? 0,
        submittedAt: p.submittedAt ?? null,
      })),
      startTime: arena.startTime,
      endTime: new Date(),
      duration: arena.duration,
    });

    await Arena.deleteOne({ _id: arenaId });


    io.to(arenaId).emit('arena-ended', { message: 'Arena ended' });
    gameTimers.delete(arenaId);
  } catch (err) {
    console.error('Error ending arena:', err);
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
    if (!arena) {
      res.status(404).json({ msg: 'Arena not found.' });
      return;
    }

    const machine = await Machine.findById(machineId);
    if (!machine) {
      res.status(404).json({ msg: 'Machine not found.' });
      return;
    }

    // ✅ 수정: 중복 제출 체크 강화 (정답/오답 모두)
    const existingSubmission = arena.submissions.find(
      (sub) => sub.user.toString() === userId
    );
    
    if (existingSubmission) {
      if (existingSubmission.flagCorrect) {
        res.status(400).json({ msg: '이미 정답을 제출했습니다.' });
        return;
      }
      
      // ✅ 추가: 오답 제출 시간 제한 (30초 이내 재시도 방지)
      const timeSinceLastSubmit = Date.now() - new Date(existingSubmission.submittedAt).getTime();
      if (timeSinceLastSubmit < 30000) {
        res.status(429).json({ 
          msg: '너무 빠른 재시도입니다. 30초 후에 다시 시도해주세요.',
          retryAfter: Math.ceil((30000 - timeSinceLastSubmit) / 1000)
        });
        return;
      }
    }

    const isMatch = await bcrypt.compare(flag, machine.flag);
    const now = new Date();

    if (!isMatch) {
      // ❌ 오답 제출 기록
      arena.submissions.push({
        user: userId,
        submittedAt: now,
        flagCorrect: false,
      });

      // 참가자 상태 갱신
      const participant = arena.participants.find(p => p.user.toString() === userId);
      if (participant) participant.status = 'flag_submitted';

      await arena.save();
      res.status(400).json({ msg: 'Incorrect flag.' });
      return;
    }

    // ✅ 수정: 원자적 첫 풀이자 체크 - Race Condition 방지
    const graceMs = arena.settings?.graceMs ?? 90_000;
    
    const result = await Arena.findOneAndUpdate(
      { 
        _id: arenaId, 
        firstSolvedAt: { $exists: false },
        status: 'started'
      },
      { 
        $set: { 
          winner: userId, 
          firstSolvedAt: now,
          endTime: new Date(Date.now() + graceMs)
        }
      },
      { new: true }
    );
    
    const isFirstSolve = !!result;
    
    // 첫 풀이자가 아니어도 제출 기록은 해야 함
    if (!isFirstSolve) {
      const currentArena = await Arena.findById(arenaId);
      if (currentArena) {
        currentArena.submissions.push({
          user: userId,
          submittedAt: now,
          flagCorrect: true,
        });
        
        const participant = currentArena.participants.find(p => p.user.toString() === userId);
        if (participant) participant.status = 'completed';
        
        await currentArena.save();
      }
    } else {
      // 첫 풀이자인 경우 result에 이미 업데이트되어 있으므로 submissions만 추가
      const currentArena = await Arena.findById(arenaId);
      if (currentArena) {
        currentArena.submissions.push({
          user: userId,
          submittedAt: now,
          flagCorrect: true,
        });
        
        const participant = currentArena.participants.find(p => p.user.toString() === userId);
        if (participant) participant.status = 'completed';
        
        await currentArena.save();
      }
    }

    // 🎁 EXP 지급
    const user = await User.findById(userId);
    if (user) {
      user.exp += arena.arenaExp;
      // ✅ 수정: optional chaining 제거 (이미 user 체크함)
      if (typeof (user as any).updateLevel === 'function') {
        await (user as any).updateLevel();
      }
      await user.save();
    }

    // 최신 arena 정보 가져오기
    const updatedArena = await Arena.findById(arenaId);
    if (!updatedArena) {
      res.status(404).json({ msg: 'Arena not found after update.' });
      return;
    }

    res.status(200).json({
      msg: isFirstSolve ? '정답입니다! (그레이스 타임 시작)' : '정답입니다!',
      correct: true,
      expEarned: updatedArena.arenaExp,
      totalExp: user?.exp || 0,
    });

    // 📡 클라 업데이트
    const populated = await Arena.findById(arenaId)
      .populate('participants.user', '_id username')
      .lean();
    const io = req.app.get('io');
    io.to(arenaId).emit('arena:update', {
      arenaId: String(populated?._id || arenaId),
      status: populated?.status || 'waiting',
      host: String((populated?.host as any)?._id ?? populated?.host ?? ''),
      startTime: populated?.startTime || null,
      endTime: populated?.endTime || null,
      problemInstanceId: populated?.problemInstanceId || null,
      problemInstanceIp: populated?.problemInstanceIp || null,
      participants: (populated?.participants || []).map((pp: any) => ({
        user: pp.user,
        isReady: !!pp.isReady,
        hasLeft: !!pp.hasLeft,
        vpnIp: pp.vpnIp ?? null,
        status: pp.status || 'waiting',
      })),
    });

    // ⏱ 첫 풀이자면 종료 타이머 재예약
    if (isFirstSolve && updatedArena.endTime) {
      scheduleEnd(String(updatedArena._id), updatedArena.endTime, io);
    }

    // 🔚 전원 정답 제출 시 즉시 종료
    const totalParticipants = updatedArena.participants.filter(p => !p.hasLeft).length;
    const correctSubmissions = updatedArena.submissions.filter(s => s.flagCorrect).length;
    if (correctSubmissions >= totalParticipants && totalParticipants > 0) {
      await endArena(arenaId, io);
    }

  } catch (error) {
    console.error('Arena flag 제출 중 오류:', error);
    res.status(500).json({ msg: 'Arena flag 제출 실패' });
  }
};

export const receiveArenaVpnIp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { arenaId, vpnIp } = req.body;
    const userId = res.locals.jwtData?.id;

    if (!arenaId || !userId || !vpnIp) {
      res.status(400).json({ msg: '필수 정보 누락됨.' });
      return;
    }

    const arena = await Arena.findById(arenaId);
    if (!arena) {
      res.status(404).json({ msg: 'Arena not found.' });
      return;
    }

    const participant = arena.participants.find(p => 
      String((p.user as any)?._id ?? p.user) === String(userId)
    );

    if (!participant) {
      res.status(404).json({ msg: 'Participant not found.' });
      return;
    }

    // VPN IP 할당
    participant.vpnIp = vpnIp;
    (participant as any).status = 'vm_connected';
    
    await arena.save();

    res.status(200).json({ 
      msg: 'VPN IP updated successfully',
      problemInstanceIp: arena.problemInstanceIp 
    });

    // 실시간 업데이트
    const io = req.app.get('io');
    const populated = await Arena.findById(arenaId)
      .populate('participants.user', '_id username')
      .lean();

    io.to(arenaId).emit('arena:update', {
      arenaId: String(populated?._id || arenaId),
      status: populated?.status || 'started',
      host: String((populated?.host as any)?._id ?? populated?.host ?? ''),
      startTime: populated?.startTime || null,
      endTime: populated?.endTime || null,
      problemInstanceId: populated?.problemInstanceId || null,
      problemInstanceIp: populated?.problemInstanceIp || null,
      participants: (populated?.participants || []).map((pp: any) => ({
        user: pp.user,
        isReady: !!pp.isReady,
        hasLeft: !!pp.hasLeft,
        vpnIp: pp.vpnIp ?? null,
        status: pp.status || 'waiting',
      })),
    });

  } catch (error) {
    console.error('Error receiving arena VPN IP:', error);
    res.status(500).send('Failed to receive VPN IP.');
  }
};

export const getArenaResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const { arenaId } = req.params;
    const arena = await Arena.findById(arenaId)
      .populate('participants.user', 'username')
      .populate('winner', 'username');

    // ✅ 수정: return 추가
    if (!arena) {
      res.status(404).json({ msg : 'Arena not found.'});
      return;
    }

    // ✅ 수정: return 추가
    if (arena.status !== 'ended') {
      res.status(400).json({ msg: 'Arena is not finished yet.'});
      return;
    }

    const participants = arena.participants.filter(p => !p.hasLeft).map(p => {
      // ✅ 수정: optional chaining 추가
      const userSubmission = arena.submissions?.find(s => 
        s.user.toString() === p.user._id.toString() && s.flagCorrect === true
      );

      let completionTime = null;

      if (userSubmission && arena.startTime) {
        const startTime = new Date(arena.startTime).getTime();
        const submitTime = new Date(userSubmission.submittedAt).getTime();
        completionTime = Math.floor((submitTime - startTime) / 1000);
      }

      return {
        userId: p.user._id,
        username: p.user ? (p.user as any).username : "Unknown User",
        status: p.status,
        completionTime: completionTime,
        submittedAt: userSubmission ? userSubmission.submittedAt : null,
        isCompleted: p.status === 'flag_submitted' || p.status === 'completed'
      };
    })
    .sort((a, b) => {
      if (a.isCompleted && !b.isCompleted) return -1;
      if (!a.isCompleted && b.isCompleted) return 1;

      if (a.isCompleted && b.isCompleted) {
        if (a.completionTime && b.completionTime) {
          return a.completionTime - b.completionTime;
        }
        return 0;
      }
      const getStatusPriority = (status) => {
        if (status === 'vm_connected') return 1;
        if (status === 'vpn_connecting') return 2;
        if (status === 'waiting') return 3;
        return 4;
      };
      
      return getStatusPriority(a.status) - getStatusPriority(b.status);
    })
    .map((p, index) => ({
      ...p,
      rank: index + 1
    }));

    let duration = arena.duration * 60;
    
    if (arena.startTime && arena.endTime) {
      const startTime = new Date(arena.startTime);
      const endTime = new Date(arena.endTime);
      duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    }

    const completedCount = participants.filter(p => p.isCompleted).length;
    
    const winner = arena.winner ? {
      userId: arena.winner._id,
      username: arena.winner ? (arena.winner as any).username : "Unknown User",
      solvedAt: arena.firstSolvedAt
    } : null;

    const result = {
      _id: arena._id,
      name: arena.name,
      host: arena.host._id,
      hostName: arena.host ? (arena.host as any).username : "Unknown Host",
      status: arena.status,
      category: arena.category,
      startTime: arena.startTime,
      endTime: arena.endTime,
      duration: duration,
      participants: participants,
      winner: winner,
      firstSolvedAt: arena.firstSolvedAt,
      arenaExp: arena.arenaExp,
      stats: {
        totalParticipants: participants.length,
        completedCount: completedCount,
        successRate: participants.length > 0 ? Math.round((completedCount / participants.length) * 100) : 0
      },
      settings: {
        endOnFirstSolve: arena.settings.endOnFirstSolve,
        graceMs: arena.settings.graceMs,
        hardTimeLimitMs: arena.settings.hardTimeLimitMs
      }
    };

    res.json(result);

  } catch (error) {
    console.error('Get arena result error:', error);
    res.status(500).json({ msg: 'Failed to get arena results' });
  }
};

export const getArenaHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData.id;

    const history = await ArenaProcess.find({
      "participants.user": userId,
    })
      .populate("machine", "name")
      .populate("winner", "username")
      .sort({ endTime: -1 })
      .limit(20);

    res.status(200).json({ arenaHistory: history });
  } catch (err) {
    console.error("Failed to fetch arena history:", err);
    res.status(500).json({ message: "Failed to fetch arena history." });
  }
};