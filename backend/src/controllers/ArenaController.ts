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
  // — 공통 유틸: 참가자 리스트와 호스트를 전파
  const broadcastUpdate = async (arenaId) => {
    const arena = await Arena.findById(arenaId).populate('participants.user', 'username');
    io.to(arenaId).emit('arena:update', {
      participants: arena.participants,
      host: arena.host.toString(),
      status: arena.status,
    });
  };

  // 입장
  socket.on('arena:join', async ({ arenaId, userId }) => {
    socket.userId = userId; socket.arenaId = arenaId;
    const arena = await Arena.findById(arenaId);
    if (!arena) return socket.emit('arena:join-failed', { reason: '방이 없습니다.' });

    if (!arena.participants.some(p => p.user.toString() === userId)) {
      arena.participants.push({ user: userId, isReady: false });
      await arena.save();
    }

    socket.join(arenaId);
    await broadcastUpdate(arenaId);
  });

  // 준비
  socket.on('arena:ready', async ({ arenaId, userId, isReady }) => {
    const arena = await Arena.findById(arenaId);
    const p = arena?.participants.find(x => x.user.toString() === userId);
    if (p) {
      p.isReady = isReady;
      await arena.save();
      await broadcastUpdate(arenaId);
    }
  });

  // 나가기
  socket.on('arena:leave', async ({ arenaId, userId }) => {
    const arena = await Arena.findById(arenaId) as any;
    if (!arena) return;

    // 참가자 목록에서 제거
    arena.participants = arena.participants.filter((p: any) => p.user.toString() !== userId);
    await arena.save();

    // **빈 방이면(혼자 남았다 나감 포함) 상태 상관 없이 바로 삭제**
    if (arena.participants.length === 0) {
      await Arena.deleteOne({ _id: arenaId });
      // 전체에 브로드캐스트
      io.emit('arena:deleted', { arenaId });
    } else {
      await broadcastUpdate(arenaId);
    }
  });

  // disconnect
  socket.on('disconnect', async () => {
    const { arenaId, userId } = socket;
    if (!arenaId || !userId) return;
    const arena = await Arena.findById(arenaId) as any;
    if (!arena) return;

    arena.participants = arena.participants.filter(p => p.user.toString() !== userId);
    if (arena.host.toString() === userId && arena.participants.length > 0) {
      arena.host = arena.participants[0].user;
    }
    await arena.save();

    if (arena.participants.length === 0 && arena.status === 'waiting') {
      await Arena.deleteOne({ _id: arenaId });
      io.emit('arena:deleted', { arenaId });
    } else {
      await broadcastUpdate(arenaId);
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

    await Instance.deleteMany({ arena: arenaId });
  } catch (err) {
    console.error('endArena error:', err);
  }
};

