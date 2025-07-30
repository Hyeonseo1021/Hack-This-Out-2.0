import { Request, Response } from 'express';
import Arena from '../models/Arena';
import Machine from '../models/Machine';
import bcrypt from 'bcrypt';
import { Socket, Server } from 'socket.io';
import { io } from '../config/socket';

export const registerArenaSocketHandlers = (socket: Socket, io: Server) => {
  socket.on('arena:join', async ({ arenaId, userId }) => {
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;
      
      socket.join(arenaId);

      io.to(arenaId).emit('arena:update-participants', arena.participants);
    } catch (err) {
      console.error('arena:join error', err);
    }
  });

  socket.on('arena:ready', async ({ arenaId, userId, isReady }) => {
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      const participant = arena.participants.find(p => p.user.toString() === userId);
      if (!participant) return;

      participant.isReady = isReady;
      await arena.save();

      io.to(arenaId).emit('arena:update-participants', arena.participants);
    } catch (err) {
      console.error('arena:ready error', err);
    }
  });

  socket.on('arena:start', async ({ arenaId }) => {
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) return;

      const allReady = arena.participants.every(p => p.isReady);
      if (!allReady) return;

      arena.status = 'started';
      arena.startTime = new Date();
      arena.endTime = new Date(arena.startTime.getTime() + arena.duration * 60 * 1000);
      await arena.save();

      io.to(arenaId).emit('arena:start');
    } catch (err) {
      console.error('arena:start error', err);
    }
  });
};

export const createArena = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, host, category, difficulty, maxParticipants, machines, duration, arenaExp} = req.body;

        if (!name || !host || !category || !difficulty || !machines || !duration || !arenaExp) {
            res.status(400).json({
                message: 'ERROR',
                msg: 'Missing required fields.'
            });
            return;
        }

        if (!Array.isArray(machines) || machines.length === 0) {
            res.status(400).json({
                message: 'ERROR',
                msg: 'At least one machine must be specified.'
            });
            return;
        }

        const machineDocs = await Machine.find({ _id: { $in: machines } });
        if (machineDocs.length !== machines.length) {
            res.status(400).json({
                message: 'ERROR',
                msg: 'One or more machine IDs are invalid.'
            });
            return;
        }

        const newArena = new Arena({ name, host, category, difficulty, maxParticipants, machines, duration, arenaExp });

        await newArena.save();

        res.status(201).json({
            message: 'OK',
            msg: "Arena created successfully.",
            arena: newArena
        });
    } catch (error: any) {
        console.error("Error creating arena:", error);
        res.status(500).json({
            message: 'ERROR',
            msg: 'Failed to create arena.',
            error: error.message
        });
    }
};

export const joinArena = async (req:Request, res:Response): Promise<void> => {
    try {
        const { arenaId } = req.params;
        const { userId } = req.body;

        const arena = await Arena.findById(arenaId);
        if (!arena) {
            res.status(404).json({ message: "ERROR", msg: 'Arena not found.'});
            return;
        }

        const alreadyParticipant = arena.participants.some(p => p.user.toString() === userId);
        if (alreadyParticipant) {
        res.status(400).json({ message: 'ERROR', msg: 'User already joined this arena.' });
        return;
        }

        if (arena.participants.length >= arena.maxParticipants) {
            res.status(400).json({ message: 'ERROR', msg: 'Arena is full.'});
            return;
        }

        arena.participants.push({ user: userId, isReady: false });
        await arena.save();

        res.status(200).json({
            message: 'OK',
            msg: 'Successfully joined the arena.',
            arena
        });
    } catch (error: any) {
        console.error('Error joining arena:', error);
        res.status(500).json({ message: 'ERROR', msg: 'Failed to join arena.', error: error.message });
    }
};

export const readyArena = async (req: Request, res: Response): Promise<void> => {
  try {
    const { arenaId } = req.params;
    const { userId } = req.body;

    const arena = await Arena.findById(arenaId);
    if (!arena) {
      res.status(404).json({ message: 'ERROR', msg: 'Arena not found.' });
      return;
    }

    const participant = arena.participants.find(p => p.user.toString() === userId);
    if (!participant) {
      res.status(400).json({ message: 'ERROR', msg: 'User is not a participant of this arena.' });
      return;
    }

    participant.isReady = true; // 혹은 participant.isReady = !participant.isReady; 로 toggle도 가능
    await arena.save();

    res.status(200).json({
      message: 'OK',
      msg: 'User marked as ready.',
      arena
    });
  } catch (error: any) {
    console.error('Error updating readiness:', error);
    res.status(500).json({
      message: 'ERROR',
      msg: 'Failed to update ready status.',
      error: error.message
    });
  }
};

export const startArena = async (req: Request, res: Response): Promise<void> => {
  try {
    const { arenaId } = req.params;
    const { userId } = req.body; // 현재는 바디로 받지만 나중에 verifyToken으로 대체 가능

    const arena = await Arena.findById(arenaId);
    if (!arena) {
      res.status(404).json({ message: 'ERROR', msg: 'Arena not found.' });
      return;
    }

    // ✅ 방장인지 확인
    if (arena.host.toString() !== userId) {
      res.status(403).json({ message: 'ERROR', msg: 'Only the host can start the arena.' });
      return;
    }

    // ✅ 상태 확인
    if (arena.status !== 'waiting') {
      res.status(400).json({ message: 'ERROR', msg: 'Arena has already started or ended.' });
      return;
    }

    // ✅ 최대 인원 도달 여부 확인
    if (arena.participants.length < arena.maxParticipants) {
      res.status(400).json({ message: 'ERROR', msg: 'Not enough participants to start.' });
      return;
    }

    // ✅ 모든 참가자 준비 상태 확인
    const allReady = arena.participants.every(p => p.isReady);
    if (!allReady) {
      res.status(400).json({ message: 'ERROR', msg: 'All participants must be ready.' });
      return;
    }

    // ✅ 시작 처리
    const now = new Date();
    const end = new Date(now.getTime() + arena.duration * 60 * 1000); // duration은 분 단위

    arena.status = 'started';
    arena.startTime = now;
    arena.endTime = end;

    await arena.save();

    res.status(200).json({
      message: 'OK',
      msg: 'Arena started successfully.',
      startTime: now,
      endTime: end
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'ERROR',
      msg: 'Failed to start arena.',
      error: error.message
    });
  }
};