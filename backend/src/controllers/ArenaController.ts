import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { EC2Client, RunInstancesCommand, RunInstancesCommandInput, TerminateInstancesCommand } from "@aws-sdk/client-ec2"; 
import Arena from '../models/Arena';
import User from '../models/User';
import Instance from '../models/Instance';
import config from '../config/config';
import Machine from '../models/Machine';

const ec2Client = new EC2Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId!,
    secretAccessKey: config.aws.secretAccessKey!,
  },
});

export const registerArenaSocketHandlers = (socket, io) => {
  const broadcastUpdate = async (arenaId) => {
    const arena = await Arena.findById(arenaId).populate('participants.user', 'username');
    io.to(arenaId).emit('arena:update', {
      participants: arena.participants,
      host: arena.host.toString(),
      status: arena.status,
    });
  };

  // ✅ 입장
  socket.on('arena:join', async ({ arenaId, userId }) => {
    socket.userId = userId;
    socket.arenaId = arenaId;

    const arena = await Arena.findById(arenaId);
    if (!arena) return socket.emit('arena:join-failed', { reason: '방이 없습니다.' });

    const existing = arena.participants.find(p => p.user.toString() === userId);
    if (!existing) {
      arena.participants.push({ user: userId, isReady: false, hasLeft: false });
    } else {
      existing.hasLeft = false; // ✅ 다시 복귀한 경우
    }

    await arena.save();
    socket.join(arenaId);
    await broadcastUpdate(arenaId);
  });

  // ✅ 준비 상태 변경
  socket.on('arena:ready', async ({ arenaId, userId, isReady }) => {
    const arena = await Arena.findById(arenaId);
    const p = arena?.participants.find(x => x.user.toString() === userId);
    if (p) {
      p.isReady = isReady;
      await arena.save();
      await broadcastUpdate(arenaId);
    }
  });

  socket.on('arena:start', async ({ arenaId, userId }) => {
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      if (arena.host.toString() !== userId) return;

      const allReady = arena.participants.length > 0 && arena.participants.every(p => p.isReady);
      if (!allReady) {
        socket.emit('arena:start-failed', { reason: '모든 참가자가 준비되지 않았습니다.' });
        return;
      }

      const machineId = arena.machine[0];
      const machine = await Machine.findById(machineId);
      if (!machine || !machine.amiId) {
        socket.emit('arena:start-failed', { reason: '문제 머신 정보가 올바르지 않습니다.' });
        return;
      }

      const instances = await Promise.all(
        arena.participants.map(async (p) => {
          const params: RunInstancesCommandInput = {
            ImageId: machine.amiId,
            InstanceType: 't2.micro',
            MinCount: 1,
            MaxCount: 1,
            KeyName: config.aws.keyName!,
            SecurityGroupIds: [config.aws.securityGroupId!],
            TagSpecifications: [
              {
                ResourceType: 'instance',
                Tags: [
                  { Key: 'User', Value: p.user.toString() },
                  { Key: 'Arena', Value: arenaId },
                ],
              },
            ],
          };

          const command = new RunInstancesCommand(params);
          const result = await ec2Client.send(command);
          const instance = result.Instances?.[0];

          return {
            userId: p.user.toString(),
            instanceId: instance?.InstanceId ?? '',
            publicIp: instance?.PublicIpAddress ?? '',
          };
        })
      );

      // 인스턴스 정보 저장
      for (const instanceInfo of instances) {
        const participant = arena.participants.find(p => p.user.toString() === instanceInfo.userId);
        if (participant) {
          participant.instanceId = instanceInfo.instanceId;
          participant.publicIp = instanceInfo.publicIp;
        }
      }

      arena.status = 'started';
      const now = new Date();
      arena.startTime = now;
      arena.endTime = new Date(now.getTime() + arena.duration * 60000);
      await arena.save();

      io.to(arenaId).emit('arena:start', {
        startTime: arena.startTime,
        endTime: arena.endTime,
        message: '게임이 시작되었습니다!',
      });

    } catch (err) {
      console.error('arena:start error:', err);
      socket.emit('arena:start-failed', { reason: '인스턴스 생성 중 오류 발생' });
    }
  });


  // ✅ 나가기 버튼 클릭 시
  socket.on('arena:leave', async ({ arenaId, userId }) => {
    const arena = await Arena.findById(arenaId);
    if (!arena) return;

    const index = arena.participants.findIndex(p => p.user.toString() === userId);
    if (index !== -1) arena.participants.splice(index, 1); // 완전 제거
    await arena.save();

    if (arena.participants.length === 0) {
      await Arena.deleteOne({ _id: arenaId });
      io.emit('arena:deleted', { arenaId });
    } else {
      await broadcastUpdate(arenaId);
    }
  });

  // ✅ 새로고침, 강제 종료 등
  socket.on('disconnect', async () => {
    const { arenaId, userId } = socket;
    if (!arenaId || !userId) return;

    const arena = await Arena.findById(arenaId);
    if (!arena) return;

    const p = arena.participants.find(p => p.user.toString() === userId);
    if (p) p.hasLeft = true;

    // 호스트가 나간 경우, 남은 사람 중에서 재할당
    if (arena.host.toString() === userId) {
      const next = arena.participants.find(p => !p.hasLeft);
      if (next) arena.host = next.user;
    }

    const stillActive = arena.participants.filter(p => !p.hasLeft);
    // disconnect에서 Arena 삭제 유예 적용
    if (stillActive.length === 0 && arena.status === 'waiting') {
      setTimeout(async () => {
        const latest = await Arena.findById(arenaId);
        if (!latest) return;
        const alive = latest.participants.filter(p => !p.hasLeft);
        if (alive.length === 0 && latest.status === 'waiting') {
          await Arena.deleteOne({ _id: arenaId });
          io.emit('arena:deleted', { arenaId });
        }
      }, 10000);
    }

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

    const candidtae = await Machine.aggregate([
      { $match: { category, isBattleOnly: true } },
      { $sample: { size: 1 } }
    ]);

    if (candidtae.length === 0) {
      res.status(404).json({ message: 'No suitable arena machine found.' });
      return;
    }

    const machine = candidtae[0]

    const newArena = await Arena.create({
      name, 
      host: userId,
      category, 
      maxParticipants,
      duration,
      machine: [machine._id],
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


