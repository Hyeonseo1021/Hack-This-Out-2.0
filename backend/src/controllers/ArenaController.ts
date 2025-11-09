import { Request, Response } from 'express';
import Arena from '../models/Arena'; // 새 스키마
import ArenaProcess from '../models/ArenaProgress';

/**
 * 1. 아레나 생성 (POST /api/arena/create)
 * - 프론트엔드에서 '방 만들기' 버튼을 눌렀을 때 호출됩니다.
 * - 새 스키마('mode' 기반)에 맞게 Machine 관련 로직을 제거했습니다.
 */
export const createArena = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // 'machineId' 대신 'mode'를 받습니다.
    const { name, mode, maxParticipants, duration } = req.body;
    if (!name || !mode || !maxParticipants || !duration) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    if (name.length > 30) {
      res.status(400).json({ message: 'Arena name must be 30 characters or fewer.' });
      return;
    }

    // 사용자가 이미 다른 활성 방에 있는지 확인
    const existingArena = await Arena.findOne({
      'participants.user': userId,
      'participants.hasLeft': { $ne: true },
      status: { $in: ['waiting', 'started'] }
    });

    if (existingArena) {
      console.warn(`[createArena] User ${userId} tried to create arena while in ${existingArena._id}`);
      res.status(400).json({ 
        message: '이미 다른 방에 참여 중입니다.',
        existingArenaId: existingArena._id 
      });
      return;
    }

    const newArena = await Arena.create({
      name, 
      mode, 
      host: userId,
      maxParticipants, 
      duration,      
      participants: [{ user: userId, isReady: false, hasLeft: false }],
      status: 'waiting'
    });

    // 로비에 있는 모든 유저에게 새 방이 생겼음을 알림
    // (소켓 핸들러의 'arena:room-updated' 형식과 맞추는 것이 좋습니다)
    const io = req.app.get('io');
    io.emit('arena:room-updated', {
      _id: String(newArena._id),
      name: newArena.name,
      mode: newArena.mode,
      status: newArena.status,
      maxParticipants: newArena.maxParticipants,
      activeParticipantsCount: 1, // 생성 시점엔 1명
    });
    
    res.status(201).json(newArena);

  } catch (err) {
    console.error('Create arena error:', err);
    res.status(500).json({ message: 'Internal server error'});
  }
};

export const getArenas = async (req: Request, res: Response): Promise<void> => {
  try {
    const arenas = await Arena.aggregate([
      {
        $match: {
          status: { $in: ['waiting', 'started'] } // ← started도 포함
        }
      },
      {
        $addFields: {
          activeParticipantsCount: {
            $size: {
              $filter: {
                input: '$participants',
                as: 'p',
                cond: { $ne: ['$$p.hasLeft', true] }
              }
            }
          }
        }
      },
      {
        $match: {
          activeParticipantsCount: { $gt: 0 }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          mode: 1,
          maxParticipants: 1,
          status: 1,
          activeParticipantsCount: 1,
          host: 1,
          createdAt: 1
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');

    res.status(200).json(arenas);
    
  } catch (err) {
    console.error('Get arenas error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
/**
 * 3. 아레나 상세 정보 (GET /api/arena/:arenaId)
 * - 특정 방에 입장할 때 (페이지 새로고침 등) 방의 기본 정보를 불러옵니다.
 * - 이 데이터로 초기 렌더링 후, 소켓의 'arena:sync'로 실시간 데이터를 덮어씁니다.
 */
export const getArenaById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { arenaId } = req.params;
    const arena = await Arena.findById(String(arenaId))
      .populate('participants.user', 'username'); // 참가자 유저네임 포함

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

/**
 * 4. 아레나 참여 내역 (GET /api/arena/history)
 * - '마이페이지' 등에서 내가 참여했던 아레나 기록을 봅니다.
 * - ArenaProcess 모델을 조회합니다.
 */
export const getArenaHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData.id;

    const history = await ArenaProcess.find({
      "participants.user": userId,
    })
      .populate("winner", "username") // Machine populate 제거
      .sort({ endTime: -1 })
      .limit(20);

    res.status(200).json({ arenaHistory: history });
  } catch (err) {
    console.error("Failed to fetch arena history:", err);
    res.status(500).json({ message: "Failed to fetch arena history." });
  }
};