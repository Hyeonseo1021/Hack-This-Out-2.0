import { Request, Response } from 'express';
import Arena from '../models/Arena';
import ArenaProcess from '../models/ArenaProgress';

export const createArena = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { name, mode, maxParticipants, duration } = req.body;
    if (!name || !mode || !maxParticipants || !duration) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    if (name.length > 30) {
      res.status(400).json({ message: 'Arena name must be 30 characters or fewer.' });
      return;
    }

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

    console.log('=== CREATE ARENA ===');
    console.log('Arena ID:', newArena._id);
    console.log('Name:', newArena.name);
    console.log('Participants:', newArena.participants);
    console.log('===================');

    // 저장 직후 다시 조회하여 확인
    const savedArena = await Arena.findById(newArena._id).lean();
    console.log('Verified participants in DB:', savedArena?.participants);

    const io = req.app.get('io');
    
    if (io) {
      const payload = {
        _id: String(newArena._id),
        name: newArena.name,
        mode: newArena.mode,
        status: newArena.status,
        maxParticipants: newArena.maxParticipants,
        activeParticipantsCount: 1,
      };
      
      console.log('Emitting to lobby:', payload);
      io.emit('arena:room-updated', payload);
    } else {
      console.error('❌ Socket.IO instance not found');
    }
    
    res.status(201).json(newArena);

  } catch (err) {
    console.error('Create arena error:', err);
    res.status(500).json({ message: 'Internal server error'});
  }
};

// ✅ 수정된 getArenas - aggregate 대신 find 사용
export const getArenas = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('\n=== GET ARENAS ===');
    
    // 1. 모든 waiting/started 방을 가져옴
    const arenas = await Arena.find({
      status: { $in: ['waiting', 'started'] }
    })
      .select('name mode maxParticipants status participants host createdAt')
      .sort({ createdAt: -1 })
      .lean();

    console.log('Found arenas in DB:', arenas.length);
    
    if (arenas.length > 0) {
      console.log('Sample arena:', {
        _id: arenas[0]._id,
        name: arenas[0].name,
        participantsCount: arenas[0].participants?.length || 0,
        participants: arenas[0].participants
      });
    }

    // 2. JavaScript에서 activeParticipantsCount 계산
    const result = arenas
      .map(arena => {
        const activeCount = (arena.participants || []).filter(
          p => p.hasLeft !== true
        ).length;
        
        return {
          _id: arena._id,
          name: arena.name,
          mode: arena.mode,
          maxParticipants: arena.maxParticipants,
          status: arena.status,
          activeParticipantsCount: activeCount,
          host: arena.host,
          createdAt: arena.createdAt
        };
      })
      .filter(arena => arena.activeParticipantsCount > 0);

    console.log('After filtering (activeCount > 0):', result.length);
    console.log('==================\n');

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');

    res.status(200).json(result);
    
  } catch (err) {
    console.error('Get arenas error:', err);
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

export const getArenaHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData.id;

    console.log('\n=== GET ARENA HISTORY ===');
    console.log('User ID:', userId);

    // 1. 유저가 참가한 ArenaProgress 기록 조회
    const progressDocs = await ArenaProcess.find({ user: userId })
      .populate('arena') // Arena 정보 포함
      .sort({ updatedAt: -1 }) // 최근 순
      .limit(20)
      .lean();

    console.log('Progress docs found:', progressDocs.length);

    // 2. 각 progress에 대해 상세 정보 구성
    const history = await Promise.all(
      progressDocs.map(async (progress: any) => {
        const arenaData = progress.arena;
        
        // Arena가 populate되지 않았거나 삭제된 경우 스킵
        if (!arenaData || !arenaData._id) {
          return null;
        }

        // 3. 해당 Arena의 모든 참가자 progress 조회 (순위 계산용)
        const allProgress = await ArenaProcess.find({ arena: arenaData._id })
          .populate('user', 'username')
          .sort({ score: -1, updatedAt: 1 })
          .lean();

        // 4. 내 순위 찾기
        const myRank = allProgress.findIndex((p: any) => 
          String(p.user?._id || p.user) === String(userId)
        ) + 1;

        // 5. 승자 정보
        let winner = null;
        if (arenaData.winner) {
          const winnerProgress = allProgress.find((p: any) => 
            String(p.user?._id || p.user) === String(arenaData.winner)
          );
          winner = {
            _id: String(arenaData.winner),
            username: (winnerProgress?.user as any)?.username || 'Unknown'
          };
        }

        return {
          _id: String(arenaData._id),
          name: arenaData.name,
          mode: arenaData.mode,
          endTime: arenaData.endTime,
          winner,
          currentUserId: userId, // 프론트엔드에서 내 기록 찾기 위해
          participants: allProgress.map((p: any, index: number) => ({
            user: p.user?._id || p.user,
            username: (p.user as any)?.username || 'Unknown',
            score: p.score || 0,
            rank: index + 1,
            completed: p.completed || false
          }))
        };
      })
    );

    // null 값 제거 (삭제된 Arena)
    const filteredHistory = history.filter(h => h !== null);

    console.log('Filtered history count:', filteredHistory.length);
    console.log('========================\n');

    res.status(200).json({ arenaHistory: filteredHistory });
  } catch (err) {
    console.error("Failed to fetch arena history:", err);
    res.status(500).json({ message: "Failed to fetch arena history." });
  }
};

// ‼️ 새로 추가: Arena 결과 조회 (ArenaProgress 기반)
export const getArenaResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const { arenaId } = req.params;

    // 1. Arena 기본 정보 조회
    const arena = await Arena.findById(arenaId)
      .populate('host', 'username')
      .populate('participants.user', 'username')
      .populate('winner', 'username')
      .lean();

    if (!arena) {
      res.status(404).json({ message: 'Arena not found' });
      return;
    }

    // 2. 모든 참가자의 ArenaProgress 조회
    const progressDocs = await ArenaProcess.find({ arena: arenaId })
      .populate('user', 'username')
      .sort({ score: -1, updatedAt: 1 }) // 점수 높은 순, 같으면 빨리 끝낸 순
      .lean();

    console.log('\n=== GET ARENA RESULT ===');
    console.log('Arena:', arena.name);
    console.log('Progress docs found:', progressDocs.length);

    // 3. 참가자별 결과 데이터 생성
    const participants = progressDocs.map((progress, index) => {
      const user = progress.user as any;
      const userId = user?._id || progress.user;
      const username = user?.username || 'Unknown';

      // 완료 시간 계산 (마지막 플래그 제출 시간 기준)
      let completionTime = null;
      let submittedAt = null;
      if (progress.completed && progress.flags && progress.flags.length > 0) {
        const lastFlag = progress.flags[progress.flags.length - 1];
        if (lastFlag.submittedAt && arena.startTime) {
          const startMs = new Date(arena.startTime).getTime();
          const endMs = new Date(lastFlag.submittedAt).getTime();
          completionTime = Math.floor((endMs - startMs) / 1000); // 초 단위
          submittedAt = lastFlag.submittedAt;
        }
      }

      // 상태 결정
      let status: 'completed' | 'vm_connected' | 'waiting' = 'waiting';
      if (progress.completed) {
        status = 'completed';
      } else if (progress.stage > 0) {
        status = 'vm_connected'; // 어느 정도 진행함
      }

      return {
        userId: String(userId),
        username,
        status,
        completionTime,
        submittedAt,
        isCompleted: progress.completed || false,
        rank: index + 1, // 순위 (점수순으로 정렬되어 있음)
        score: progress.score || 0,
        stage: progress.stage || 0
      };
    });

    console.log('Participants with scores:', participants.map(p => ({
      username: p.username,
      score: p.score,
      rank: p.rank
    })));

    // 4. 통계 계산
    const totalParticipants = participants.length;
    const completedCount = participants.filter(p => p.isCompleted).length;
    const successRate = totalParticipants > 0 
      ? Math.round((completedCount / totalParticipants) * 100) 
      : 0;

    // 5. 승자 정보
    let winner = null;
    if (arena.winner) {
      const winnerUser = arena.winner as any;
      winner = {
        userId: String(winnerUser._id || arena.winner),
        username: winnerUser.username || 'Unknown',
        solvedAt: arena.firstSolvedAt || null
      };
    }

    // 6. 최종 결과 반환
    const result = {
      _id: String(arena._id),
      name: arena.name,
      host: String((arena.host as any)?._id || arena.host),
      hostName: (arena.host as any)?.username || 'Unknown',
      status: arena.status,
      mode: arena.mode, // category -> mode로 변경
      maxParticipants: arena.maxParticipants,
      startTime: arena.startTime,
      endTime: arena.endTime,
      duration: arena.duration,
      participants,
      winner,
      firstSolvedAt: arena.firstSolvedAt,
      arenaExp: 0, // 나중에 구현
      stats: {
        totalParticipants,
        completedCount,
        successRate
      },
      settings: {
        endOnFirstSolve: true, // 기본값
        graceMs: 0,
        hardTimeLimitMs: arena.duration * 1000
      }
    };

    console.log('Final result:', {
      name: result.name,
      participantsCount: result.participants.length,
      winner: result.winner?.username
    });
    console.log('==================\n');

    res.status(200).json(result);

  } catch (err) {
    console.error('Get arena result error:', err);
    res.status(500).json({ message: 'Failed to fetch arena results' });
  }
};