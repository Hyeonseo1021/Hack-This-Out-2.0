import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { EC2Client, DescribeImagesCommand, RunInstancesCommand, StopInstancesCommand } from "@aws-sdk/client-ec2"; 
import Arena from '../models/Arena';
import User from '../models/User';
import Instance from '../models/Instance';
import config from '../config/config';
import { param } from 'express-validator';
import { isReadable } from 'stream';
import { start } from 'repl';
import { startInstance } from './InstController';
import Machine from '../models/Machine';

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
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      if (arena.participants.length >= arena.maxParticipants) {
        socket.emit('arena:join-failed', { reason: '최대 참가 인원 초과' });
        return;
      }

      const alreadyJoined = arena.participants.some(
        (p) => p.user.toString() === userId
      );
      if (!alreadyJoined) {
        arena.participants.push({ user: userId, isReady: false, hasLeft: false });
        await arena.save();
      }

      socket.join(arenaId);

      io.to(arenaId).emit('arena:update-participants', arena.participants); 
    } catch (err) {
      console.error('arena:join error:', err);
      socket.emit('arena:join-failed', { reason: '오류 발생' });
    }
  });

  socket.on('arena:ready', async ({ arenaId, userId, isReady }) => {
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      const participants = arena.participants.find(p => p.user.toString() === userId);
      if (participants) {
        participants.isReady = isReady;
        await arena.save();
        io.to(arenaId).emit('arena:update-participants', arena.participants);
      }
    } catch (err) {
      console.error('arena:ready error:', err);
    }
  });

  /*socket.on('arena:start', async ({ arenaId, userId }) => {
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      if (arena.host.toString() !== userId) return;

      const allReady = arena.participants.length > 0 && arena.participants.every(p => p.isReady);
      if (!allReady) {
        socket.emit('arena:start-failed', { reason: '모든 참가자가 준비되지 않았습니다.' });
        return;
      }

      const now = new Date();
      arena.status = 'started';
      arena.startTime = now;
      arena.endTime = new Date(now.getTime() + arena.duration * 60000);
      await arena.save(); // ✅ 상태 변경 후 저장 필요

      const instanceId = await startArenaInstance(arenaId); // ✅ 인스턴스 생성

      if (!instanceId) {
        io.to(arenaId).emit('arena:error', { reason: '인스턴스 생성 실패' });
        return;
      }

      io.to(arenaId).emit('arena:start', {
        startTime: arena.startTime,
        endTime: arena.endTime,
        instanceId,
      });
    } catch (err) {
      console.error('arena:start error:', err); 
    }
  });*/
  
  socket.on('arena:leave', async ({ arenaId, userId }) => {
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;
      arena.set('participants', arena.participants.filter(p => p.user.toString() !== userId));
      await arena.save();

      io.to(arenaId).emit('arena:update-participants', arena.participants);

      // 방장이 나가고 아무도 없으면 삭제
      if (arena.participants.length === 0 && arena.status === 'waiting') {
        await Arena.deleteOne({ _id: arena._id });
        io.emit('arena:deleted', { arenaId: arena._id });
      }
    } catch (err) {
      console.error('arena:leave error:', err);
    }
  });

  socket.on('disconnect', async () => {
    if (socket.userId) {
      await deleteArenaIfEmpty(socket.userId, io);
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
    const arena = await Arena.findById(arenaId).populate('participants.user', 'username');

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
    const arenas = await Arena.find({ 'participants.user': userId });

    for (const arena of arenas) {
      arena.set('participants', arena.participants.filter(p => p.user.toString() !== userId));


      if (arena.participants.length === 0 && arena.status === 'waiting') {
        await Arena.deleteOne({ _id: arena._id });
        io.emit('arena:deleted', { arenaId: arena._id });
      } else {
        await arena.save();
        io.to(arena._id.toString()).emit('arena:update-participants', arena.participants);
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

    await Instance.deleteMany({ arena: arenaId });
  } catch (err) {
    console.error('endArena error:', err);
  }
};

