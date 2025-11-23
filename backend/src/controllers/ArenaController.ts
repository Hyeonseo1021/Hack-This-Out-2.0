import { Request, Response } from 'express';
import Arena from '../models/Arena';
import ArenaProgress from '../models/ArenaProgress';
import ArenaScenario from '../models/ArenaScenario';
import { ArenaScenarioService } from '../services/ArenaScenarioService';

export const createArena = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { name, mode, difficulty, maxParticipants } = req.body;
    
    if (!name || !mode || !difficulty || !maxParticipants) {
      res.status(400).json({ message: 'Missing required fields (name, mode, difficulty, maxParticipants)' });
      return;
    }

    if (name.length > 30) {
      res.status(400).json({ message: 'Arena name must be 30 characters or fewer.' });
      return;
    }

    // ✅ 유효한 모드 목록 (Defense Battle 제거, Vulnerability Scanner Race 추가)
    const validModes = [
      'TERMINAL_HACKING_RACE',           // ⚡ Terminal Race
      'VULNERABILITY_SCANNER_RACE',      // 🔍 Vulnerability Scanner Race - NEW
      'KING_OF_THE_HILL',                // 👑 King of the Hill
      'FORENSICS_RUSH',                  // 🔎 Forensics Rush
      'SOCIAL_ENGINEERING_CHALLENGE'     // 💬 Social Engineering
    ];
    
    if (!validModes.includes(mode)) {
      res.status(400).json({ message: 'Invalid game mode' });
      return;
    }

    const validDifficulties = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];
    if (!validDifficulties.includes(difficulty)) {
      res.status(400).json({ message: 'Invalid difficulty' });
      return;
    }

    // ✅ Vulnerability Scanner Race 검증 (2명 고정)
    if (mode === 'VULNERABILITY_SCANNER_RACE') {
      if (maxParticipants !== 2) {
        res.status(400).json({
          message: 'Vulnerability Scanner Race는 정확히 2명의 참가자가 필요합니다.'
        });
        return;
      }
    }

    // ✅ Social Engineering 검증 (1-4명)
    if (mode === 'SOCIAL_ENGINEERING_CHALLENGE') {
      if (maxParticipants < 1 || maxParticipants > 4) {
        res.status(400).json({
          message: 'Social Engineering은 1-4명의 참가자만 지원합니다.'
        });
        return;
      }
    }

    // 일반적인 참가자 수 검증
    if (maxParticipants < 1 || maxParticipants > 8) {
      res.status(400).json({ message: 'Max participants must be between 1 and 8' });
      return;
    }

    const existingArena = await Arena.findOne({
      'participants.user': userId,
      'participants.hasLeft': { $ne: true },
      status: { $in: ['waiting', 'started'] }
    });

    if (existingArena) {
      res.status(400).json({ 
        message: '이미 다른 방에 참여 중입니다.',
        existingArenaId: existingArena._id 
      });
      return;
    }

    let scenario;
    try {
      scenario = await ArenaScenarioService.getRandomScenario(mode, difficulty);
    } catch (error: any) {
      res.status(400).json({ 
        message: `${difficulty} 난이도의 ${mode} 시나리오를 찾을 수 없습니다. 시나리오를 먼저 추가해주세요.` 
      });
      return;
    }

    const newArena = await Arena.create({
      name, 
      mode,
      difficulty,
      host: userId,
      maxParticipants,
      scenarioId: scenario._id,
      timeLimit: scenario.timeLimit,
      participants: [{ user: userId, isReady: false, hasLeft: false }],
      status: 'waiting'
    });

    const savedArena = await Arena.findById(newArena._id).lean();

    const io = req.app.get('io');
    
    if (io) {
      const payload = {
        _id: String(newArena._id),
        name: newArena.name,
        mode: newArena.mode,
        difficulty: newArena.difficulty,
        status: newArena.status,
        maxParticipants: newArena.maxParticipants,
        activeParticipantsCount: 1,
      };

      io.emit('arena:room-updated', payload);
    } else {
      console.error('❌ Socket.IO instance not found');
    }
    
    res.status(201).json({
      arena: newArena,
      scenario: {
        id: scenario._id,
        title: scenario.title,
        description: scenario.description,
        timeLimit: scenario.timeLimit
      }
    });

  } catch (err) {
    console.error('Create arena error:', err);
    res.status(500).json({ message: 'Internal server error'});
  }
};

export const getArenas = async (req: Request, res: Response): Promise<void> => {
  try {
    
    const arenas = await Arena.find({
      status: { $in: ['waiting', 'started'] }
    })
      .select('name mode difficulty maxParticipants status participants host createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const result = arenas
      .map(arena => {
        const activeCount = (arena.participants || []).filter(
          p => p.hasLeft !== true
        ).length;
        
        return {
          _id: arena._id,
          name: arena.name,
          mode: arena.mode,
          difficulty: arena.difficulty,
          maxParticipants: arena.maxParticipants,
          status: arena.status,
          activeParticipantsCount: activeCount,
          host: arena.host,
          createdAt: arena.createdAt
        };
      })
      .filter(arena => arena.activeParticipantsCount > 0);

    console.log('After filtering (activeCount > 0):', result.length);

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
      .populate('participants.user', 'username')
      .populate('scenarioId')
      .lean();

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

    console.log('User ID:', userId);

    const progressDocs = await ArenaProgress.find({ user: userId })
      .populate('arena')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    console.log('Progress docs found:', progressDocs.length);

    const history = await Promise.all(
      progressDocs.map(async (progress: any) => {
        const arenaData = progress.arena;
        
        if (!arenaData || !arenaData._id) {
          return null;
        }

        const allProgress = await ArenaProgress.find({ arena: arenaData._id })
          .populate('user', 'username')
          .sort({ score: -1, updatedAt: 1 })
          .lean();

        const myRank = allProgress.findIndex((p: any) => 
          String(p.user?._id || p.user) === String(userId)
        ) + 1;

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
          difficulty: arenaData.difficulty,
          endTime: arenaData.endTime,
          winner,
          currentUserId: userId,
          participants: allProgress.map((p: any, index: number) => ({
            user: p.user?._id || p.user,
            username: (p.user as any)?.username || 'Unknown',
            score: p.score || 0,
            rank: index + 1,
            completed: p.completed || false
          })),
          myRank,
          myScore: progress.score || 0,
          myCompleted: progress.completed || false
        };
      })
    );

    const filteredHistory = history.filter(h => h !== null);

    res.status(200).json({ history: filteredHistory });
  } catch (err) {
    console.error('getArenaHistory error:', err);
    res.status(500).json({ message: 'Failed to fetch arena history' });
  }
};

export const getArenaResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const { arenaId } = req.params;

    console.log(`📊 [getArenaResult] Fetching result for arena: ${arenaId}`);

    // 1. Arena 기본 정보 조회
    const arena = await Arena.findById(arenaId)
      .populate('host', 'username')
      .populate('winner', 'username')
      .populate('scenarioId')
      .lean();

    if (!arena) {
      res.status(404).json({ message: 'Arena not found' });
      return;
    }

    console.log(`✅ [getArenaResult] Arena found:`, {
      name: arena.name,
      mode: arena.mode,
      status: arena.status
    });

    // 2. 모든 참가자의 진행 상황 조회
    const progressDocs = await ArenaProgress.find({ arena: arenaId })
      .populate('user', 'username')
      .lean();

    console.log(`📋 [getArenaResult] Found ${progressDocs.length} participants`);

    // 3. 게임 모드별로 참가자 데이터 구성
    const participants = progressDocs.map((progress: any) => {
      const baseData = {
        userId: String(progress.user._id),
        username: progress.user.username,
        status: progress.completed ? 'completed' : (progress.score > 0 ? 'vm_connected' : 'waiting'),
        completionTime: progress.completionTime || null,
        submittedAt: progress.submittedAt || null,
        isCompleted: progress.completed || false,
        rank: 0, // 나중에 계산
        score: progress.score || 0
      };

      // ✅ 게임 모드별 추가 데이터
      switch (arena.mode) {
        case 'TERMINAL_HACKING_RACE':
          return {
            ...baseData,
            stage: progress.stage || 0,
            flags: progress.flags || []
          };

        case 'VULNERABILITY_SCANNER_RACE':  // ✅ 추가
          return {
            ...baseData,
            vulnerabilitiesFound: progress.vulnerabilityScannerRace?.vulnerabilitiesFound || 0,
            firstBloods: progress.vulnerabilityScannerRace?.firstBloods || 0,
            invalidSubmissions: progress.vulnerabilityScannerRace?.invalidSubmissions || 0
          };

        case 'KING_OF_THE_HILL':
          return {
            ...baseData,
            kingTime: progress.kingOfTheHill?.totalKingTime || 0,
            timesKing: progress.kingOfTheHill?.timesKing || 0,
            attacksSucceeded: progress.kingOfTheHill?.attacksSucceeded || 0,
            attacksFailed: progress.kingOfTheHill?.attacksFailed || 0
          };

        case 'FORENSICS_RUSH':
          return {
            ...baseData,
            questionsAnswered: progress.forensicsRush?.questionsAnswered || 0,
            questionsCorrect: progress.forensicsRush?.questionsCorrect || 0,
            totalAttempts: progress.forensicsRush?.totalAttempts || 0,
            penalties: progress.forensicsRush?.penalties || 0
          };

        case 'SOCIAL_ENGINEERING_CHALLENGE':
          return {
            ...baseData,
            objectiveAchieved: progress.socialEngineering?.objectiveAchieved || false,
            finalSuspicion: progress.socialEngineering?.finalSuspicion || 0,
            turnsUsed: progress.socialEngineering?.turnsUsed || 0
          };

        default:
          return baseData;
      }
    });

    // ✅ 4. 순위 계산
    participants.sort((a, b) => {
      // 1순위: 완료 여부
      if (a.isCompleted && !b.isCompleted) return -1;
      if (!a.isCompleted && b.isCompleted) return 1;
      
      // 2순위: 완료한 경우 제출 시간
      if (a.isCompleted && b.isCompleted) {
        if (a.submittedAt && b.submittedAt) {
          const timeA = new Date(a.submittedAt).getTime();
          const timeB = new Date(b.submittedAt).getTime();
          if (timeA !== timeB) {
            return timeA - timeB;
          }
        }
        
        if (a.completionTime !== null && b.completionTime !== null) {
          if (a.completionTime !== b.completionTime) {
            return a.completionTime - b.completionTime;
          }
        }
      }
      
      // 3순위: 점수
      if (a.score !== b.score) return b.score - a.score;
      
      return 0;
    });

    // 순위 부여
    participants.forEach((p, index) => {
      p.rank = index + 1;
    });

    console.log('🏆 Final Rankings:');
    participants.forEach(p => {
      console.log(`   ${p.rank}. ${p.username}:`, {
        score: p.score,
        completed: p.isCompleted
      });
    });

    // 5. 통계 계산
    const completedCount = participants.filter(p => p.isCompleted).length;
    const totalParticipants = participants.length;
    const successRate = totalParticipants > 0 
      ? Math.round((completedCount / totalParticipants) * 100) 
      : 0;

    // 6. Duration 계산
    let duration = 0;
    if (arena.startTime && arena.endTime) {
      duration = Math.floor(
        (new Date(arena.endTime).getTime() - new Date(arena.startTime).getTime()) / 1000
      );
    }

    // 7. Winner 정보
    let winner = null;
    if (arena.winner) {
      const winnerDoc = arena.winner as any;
      winner = {
        userId: String(winnerDoc._id),
        username: winnerDoc.username,
        solvedAt: arena.firstSolvedAt || null
      };
    }

    // 8. 모드 매핑
    const modeMapping: { [key: string]: string } = {
      'TERMINAL_HACKING_RACE': 'terminal-race',
      'VULNERABILITY_SCANNER_RACE': 'vulnerability-scanner-race',  // ✅ 추가
      'KING_OF_THE_HILL': 'king-of-the-hill',
      'FORENSICS_RUSH': 'forensics-rush',
      'SOCIAL_ENGINEERING_CHALLENGE': 'social-engineering'
    };

    // 9. 응답 데이터
    const result = {
      _id: String(arena._id),
      name: arena.name,
      host: String((arena.host as any)._id),
      hostName: (arena.host as any).username,
      status: arena.status,
      mode: modeMapping[arena.mode] || arena.mode.toLowerCase(),
      maxParticipants: arena.maxParticipants,
      startTime: arena.startTime,
      endTime: arena.endTime,
      duration,
      participants,
      winner,
      firstSolvedAt: arena.firstSolvedAt,
      arenaExp: arena.arenaExp || 0,
      stats: {
        totalParticipants,
        completedCount,
        successRate
      },
      settings: {
        endOnFirstSolve: arena.settings?.endOnFirstSolve || false,
        graceMs: arena.settings?.graceMs || 0
      }
    };

    console.log(`✅ [getArenaResult] Sending result with ${participants.length} participants`);

    res.json(result);

  } catch (error) {
    console.error('❌ [getArenaResult] Error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch arena result',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const checkArenaParticipation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { arenaId } = req.params;
    const userId = res.locals.jwtData?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const arena = await Arena.findById(arenaId)
      .select('participants')
      .lean();

    if (!arena) {
      res.status(404).json({ message: 'Arena not found' });
      return;
    }

    const participant = arena.participants.find(
      (p: any) => String(p.user) === String(userId)
    );

    if (!participant) {
      res.json({
        isParticipant: false,
        hasLeft: false
      });
      return;
    }

    res.json({
      isParticipant: true,
      hasLeft: participant.hasLeft || false
    });

  } catch (err) {
    console.error('[checkArenaParticipation] Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ===== 시나리오 관리 =====

export const getAllScenarios = async (req: Request, res: Response): Promise<void> => {
  try {
    const scenarios = await ArenaScenario.find()
      .select('-data')
      .sort({ mode: 1, difficulty: 1, createdAt: -1 });
    
    res.status(200).json({ scenarios });
  } catch (err) {
    console.error('Error fetching scenarios:', err);
    res.status(500).json({ message: 'Failed to fetch scenarios' });
  }
};

export const getScenarioById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const scenario = await ArenaScenario.findById(id);
    
    if (!scenario) {
      res.status(404).json({ message: 'Scenario not found' });
      return;
    }
    
    res.status(200).json({ scenario });
  } catch (err) {
    console.error('Error fetching scenario:', err);
    res.status(500).json({ message: 'Failed to fetch scenario' });
  }
};

export const createScenario = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mode, difficulty, title, description, timeLimit, data } = req.body;
    
    if (!mode || !difficulty || !title || !data) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }
    
    const scenario = await ArenaScenario.create({
      mode,
      difficulty,
      title,
      description,
      timeLimit,
      data,
      isActive: true,
      usageCount: 0
    });
    
    res.status(201).json({ 
      message: 'Scenario created successfully',
      scenario 
    });
  } catch (err) {
    console.error('Error creating scenario:', err);
    res.status(500).json({ message: 'Failed to create scenario' });
  }
};

export const updateScenario = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const scenario = await ArenaScenario.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!scenario) {
      res.status(404).json({ message: 'Scenario not found' });
      return;
    }
    
    res.status(200).json({ 
      message: 'Scenario updated successfully',
      scenario 
    });
  } catch (err) {
    console.error('Error updating scenario:', err);
    res.status(500).json({ message: 'Failed to update scenario' });
  }
};

export const deleteScenario = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const scenario = await ArenaScenario.findByIdAndDelete(id);
    
    if (!scenario) {
      res.status(404).json({ message: 'Scenario not found' });
      return;
    }
    
    res.status(200).json({ message: 'Scenario deleted successfully' });
  } catch (err) {
    console.error('Error deleting scenario:', err);
    res.status(500).json({ message: 'Failed to delete scenario' });
  }
};

export const toggleScenarioActive = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    const scenario = await ArenaScenario.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );
    
    if (!scenario) {
      res.status(404).json({ message: 'Scenario not found' });
      return;
    }
    
    res.status(200).json({ 
      message: `Scenario ${isActive ? 'activated' : 'deactivated'} successfully`,
      scenario 
    });
  } catch (err) {
    console.error('Error toggling scenario:', err);
    res.status(500).json({ message: 'Failed to toggle scenario' });
  }
};

export const getScenariosByMode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mode } = req.params;
    
    const scenarios = await ArenaScenario.find({ mode, isActive: true })
      .select('-data')
      .sort({ difficulty: 1, createdAt: -1 });
    
    res.status(200).json({ scenarios });
  } catch (err) {
    console.error('Error fetching scenarios by mode:', err);
    res.status(500).json({ message: 'Failed to fetch scenarios' });
  }
};

export const getScenarioStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await ArenaScenario.aggregate([
      {
        $group: {
          _id: {
            mode: '$mode',
            difficulty: '$difficulty'
          },
          count: { $sum: 1 },
          totalUsage: { $sum: '$usageCount' }
        }
      },
      {
        $sort: { '_id.mode': 1, '_id.difficulty': 1 }
      }
    ]);
    
    res.status(200).json({ stats });
  } catch (err) {
    console.error('Error fetching scenario stats:', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};

// ===== 아레나 방 관리 (관리자 전용) =====

/**
 * 모든 아레나 방 조회 (관리자용)
 */
export const getAllArenas = async (req: Request, res: Response): Promise<void> => {
  try {
    const arenas = await Arena.find()
      .populate('host', 'username')
      .populate('participants.user', 'username')
      .populate('scenarioId', 'title difficulty mode')
      .sort({ createdAt: -1 })
      .lean();

    const formattedArenas = arenas.map(arena => ({
      _id: arena._id,
      roomCode: arena._id,
      name: arena.name,
      gameMode: arena.mode,
      scenario: arena.scenarioId ? {
        _id: (arena.scenarioId as any)._id,
        title: (arena.scenarioId as any).title,
        difficulty: (arena.scenarioId as any).difficulty,
        mode: (arena.scenarioId as any).mode
      } : null,
      maxPlayers: arena.maxParticipants,
      currentPlayers: arena.participants.filter((p: any) => !p.hasLeft).length,
      participants: arena.participants.map((p: any) => ({
        userId: p.user?._id || p.user,
        username: p.user?.username || 'Unknown',
        team: p.teamName || null,
        joinedAt: p.joinedAt || arena.createdAt
      })),
      status: arena.status.toUpperCase(),
      host: {
        userId: (arena.host as any)?._id || arena.host,
        username: (arena.host as any)?.username || 'Unknown'
      },
      settings: {
        endOnFirstSolve: arena.settings?.endOnFirstSolve ?? true,
        graceMs: arena.settings?.graceMs ?? 90000
      },
      createdAt: arena.createdAt,
      startedAt: arena.startTime,
      completedAt: arena.endTime
    }));

    res.status(200).json({ arenas: formattedArenas });
  } catch (err) {
    console.error('Error fetching all arenas:', err);
    res.status(500).json({ message: 'Failed to fetch arenas' });
  }
};

/**
 * 아레나 방 삭제 (관리자 전용)
 */
export const deleteArena = async (req: Request, res: Response): Promise<void> => {
  try {
    const { arenaId } = req.params;
    
    const arena = await Arena.findById(arenaId).lean();
    
    if (!arena) {
      res.status(404).json({ message: 'Arena not found' });
      return;
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`arena:${arenaId}`).emit('arena:room-deleted', {
        message: '관리자에 의해 방이 삭제되었습니다.',
        arenaId: String(arenaId)
      });

      io.emit('arena:room-removed', { arenaId: String(arenaId) });
    }

    await ArenaProgress.deleteMany({ arena: arenaId });
    console.log(`Deleted ArenaProgress records for arena ${arenaId}`);

    await Arena.findByIdAndDelete(arenaId);
    console.log(`Deleted arena ${arenaId}`);

    res.status(200).json({ 
      message: 'Arena deleted successfully',
      arenaId: String(arenaId)
    });
  } catch (err) {
    console.error('Error deleting arena:', err);
    res.status(500).json({ message: 'Failed to delete arena' });
  }
};

/**
 * 활성 아레나 방 조회 (WAITING 또는 STARTED)
 */
export const getActiveArenas = async (req: Request, res: Response): Promise<void> => {
  try {
    const arenas = await Arena.find({
      status: { $in: ['waiting', 'started'] }
    })
      .populate('host', 'username')
      .populate('participants.user', 'username')
      .populate('scenarioId', 'title difficulty mode')
      .sort({ createdAt: -1 })
      .lean();

    const formattedArenas = arenas
      .filter(arena => arena.participants.filter((p: any) => !p.hasLeft).length > 0)
      .map(arena => ({
        _id: arena._id,
        roomCode: arena._id,
        name: arena.name,
        gameMode: arena.mode,
        scenario: arena.scenarioId ? {
          _id: (arena.scenarioId as any)._id,
          title: (arena.scenarioId as any).title,
          difficulty: (arena.scenarioId as any).difficulty,
          mode: (arena.scenarioId as any).mode
        } : null,
        maxPlayers: arena.maxParticipants,
        currentPlayers: arena.participants.filter((p: any) => !p.hasLeft).length,
        status: arena.status.toUpperCase(),
        host: {
          userId: (arena.host as any)?._id || arena.host,
          username: (arena.host as any)?.username || 'Unknown'
        },
        createdAt: arena.createdAt
      }));

    res.status(200).json({ rooms: formattedArenas });
  } catch (err) {
    console.error('Error fetching active arenas:', err);
    res.status(500).json({ message: 'Failed to fetch active arenas' });
  }
};