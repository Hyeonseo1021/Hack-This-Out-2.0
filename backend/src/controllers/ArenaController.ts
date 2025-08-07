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
    const arena = await Arena.findById(arenaId)
      .populate('participants.user', 'username')
      .exec();

    if (!arena) return;

    const activeParticipants = arena.participants.filter(p => !p.hasLeft);

    io.to(arenaId).emit('arena:update', {
      participants: activeParticipants,
      host: arena.host.toString(),
      status: arena.status,
    });
  };

  const updateArenaList = async () => {
    const all = await Arena.find().lean();
    io.emit('arena:list-update', all);
  };

  const tryDeleteArenaIfEmpty = async (arena) => {
    const stillActive = arena.participants.filter(p => !p.hasLeft);
    if (stillActive.length === 0 && arena.status === 'waiting') {
      await Arena.deleteOne({ _id: arena._id });
      io.emit('arena:deleted', { arenaId: arena._id.toString() });
      return true;
    }
    return false;
  };

  socket.on('arena:join', async ({ arenaId, userId }) => {
    socket.userId = userId;
    socket.arenaId = arenaId;

    const arena = await Arena.findById(arenaId);
    if (!arena) {
      return socket.emit('arena:join-failed', { reason: '방이 없습니다.' });
    }

    const userIdStr = userId.toString();

    const alreadyActive = arena.participants.some(
      (p) => p.user.toString() === userIdStr && !p.hasLeft
    );

    const activeCount = arena.participants.filter(p => !p.hasLeft).length;
    if (!alreadyActive && activeCount >= arena.maxParticipants) {
      return socket.emit('arena:join-failed', {
        reason: '최대 인원을 초과하여 입장할 수 없습니다.',
      });
    }

    const existing = arena.participants.find(p => p.user.toString() === userIdStr);
    if (existing) {
      await Arena.updateOne(
        { _id: arenaId, 'participants.user': userIdStr },
        { $set: { 'participants.$.hasLeft': false } }
      );
    } else {
      await Arena.findByIdAndUpdate(
        arenaId,
        {
          $addToSet: {
            participants: {
              user: userIdStr,
              isReady: false,
              hasLeft: false
            }
          }
        }
      );
    }

    socket.join(arenaId);
    await broadcastUpdate(arenaId);
    await updateArenaList();
  });

  socket.on('arena:ready', async ({ arenaId, userId, isReady }) => {
    await Arena.updateOne(
      { _id: arenaId, 'participants.user': userId },
      { $set: { 'participants.$.isReady': isReady } }
    );
    await broadcastUpdate(arenaId);
  });


  socket.on('arena:start', async ({ arenaId, userId }) => {
    console.log('[서버 수신] arena:start', arenaId, userId);
    const arena = await Arena.findById(arenaId);
    if (!arena || arena.host.toString() !== userId) return;

    const nonHostParticipants = arena.participants.filter(p => p.user.toString() !== userId && !p.hasLeft);

    const allReady = nonHostParticipants.length === 0 || nonHostParticipants.every(p => p.isReady);

    if (!allReady) {
      socket.emit('arena:start-failed', { reason: '모든 참가자가 준비를 완료해야 합니다.' });
      return;
    }

    arena.status = 'started';
    arena.startTime = new Date();
    arena.endTime = new Date(arena.startTime.getTime() + arena.duration * 60000);
    await arena.save();
    console.log('[SERVER] arena:start broadcast:', arenaId);
    io.to(arenaId).emit('arena:start', {
      arenaId, // 이거 추가!!
      startTime: arena.startTime,
      endTime: arena.endTime,
      message: '게임이 시작되었습니다!',
    });
  });

  const handleLeaveOrDisconnect = async (arenaId, userId) => {
    const arena = await Arena.findById(arenaId);
    if (!arena) return;

    const userIdStr = userId.toString();
    const updateQuery: any = {
      'participants.$.hasLeft': true,
    };

    await Arena.updateOne(
      { _id: arenaId, 'participants.user': userIdStr },
      { $set: updateQuery }
    );

    const updatedArena = await Arena.findById(arenaId);
    if (!updatedArena) return;

    const stillActive = updatedArena.participants.filter(p => !p.hasLeft);

    if (updatedArena.host.toString() === userIdStr && stillActive.length > 0) {
      await Arena.updateOne({ _id: arenaId }, { $set: { host: stillActive[0].user } });
    }

    const deleted = await tryDeleteArenaIfEmpty(updatedArena);
    if (!deleted) await broadcastUpdate(arenaId);
    await updateArenaList();
  };


  socket.on('arena:leave', async ({ arenaId, userId }) => {
    const arena = await Arena.findById(arenaId);
    if (!arena) return;

    const userIdStr = userId.toString();
    const newParticipants = arena.participants.filter(p => p.user.toString() !== userIdStr);

    const update: any = {
      participants: newParticipants,
    };

    if (arena.host.toString() === userIdStr && newParticipants.length > 0) {
      update.host = newParticipants[0].user;
    }

    const allLeft = newParticipants.length === 0;

    if (allLeft && arena.status === 'waiting') {
      await Arena.deleteOne({ _id: arenaId });
      io.emit('arena:deleted', { arenaId });
      return;
    }

    await Arena.updateOne({ _id: arenaId }, update);
    await broadcastUpdate(arenaId);
    await updateArenaList();
  });


  socket.on('disconnect', async () => {
    const arenaId = socket.arenaId;
    const userId = socket.userId;

    if (!arenaId || !userId) return;

    const arena = await Arena.findById(arenaId);
    if (!arena) return;

    // 해당 유저의 hasLeft를 true로 설정
    const participant = arena.participants.find(p => p.user.toString() === userId);
    if (participant) {
      participant.hasLeft = true;
    }

    arena.markModified('participants');
    await arena.save();

    // 모든 유저가 hasLeft === true일 경우 Arena 삭제
    const allLeft = arena.participants.every(p => p.hasLeft);
    if (allLeft) {
      console.log(`[서버] 모든 유저가 떠났습니다. Arena ${arenaId} 삭제 중`);
      await Arena.findByIdAndDelete(arenaId);
      // 필요 시 관련 인스턴스도 종료
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
  