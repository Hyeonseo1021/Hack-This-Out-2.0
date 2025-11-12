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

    const validModes = [
      'TERMINAL_HACKING_RACE',
      'CYBER_DEFENSE_BATTLE',
      'CAPTURE_THE_SERVER',
      'HACKERS_DECK',
      'EXPLOIT_CHAIN_CHALLENGE'
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

    if (maxParticipants < 2 || maxParticipants > 8) {
      res.status(400).json({ message: 'Max participants must be between 2 and 8' });
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

    if (arenas.length > 0) {
      console.log('Sample arena:', {
        _id: arenas[0]._id,
        name: arenas[0].name,
        mode: arenas[0].mode,
        difficulty: arenas[0].difficulty,
        participantsCount: arenas[0].participants?.length || 0
      });
    }

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
          }))
        };
      })
    );

    const filteredHistory = history.filter(h => h !== null);

    console.log('Filtered history count:', filteredHistory.length);
    res.status(200).json({ arenaHistory: filteredHistory });
  } catch (err) {
    console.error("Failed to fetch arena history:", err);
    res.status(500).json({ message: "Failed to fetch arena history." });
  }
};

export const getArenaResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const { arenaId } = req.params;

    const arena = await Arena.findById(arenaId)
      .populate('host', 'username')
      .populate('participants.user', 'username')
      .populate('winner', 'username')
      .populate('scenarioId')
      .lean();

    if (!arena) {
      res.status(404).json({ message: 'Arena not found' });
      return;
    }

    const progressDocs = await ArenaProgress.find({ arena: arenaId })
      .populate('user', 'username')
      .sort({ score: -1, updatedAt: 1 })
      .lean();

    const participants = progressDocs.map((progress, index) => {
      const user = progress.user as any;
      const userId = user?._id || progress.user;
      const username = user?.username || 'Unknown';

      let completionTime = null;
      let submittedAt = null;
      if (progress.completed && progress.flags && progress.flags.length > 0) {
        const lastFlag = progress.flags[progress.flags.length - 1];
        if (lastFlag.submittedAt && arena.startTime) {
          const startMs = new Date(arena.startTime).getTime();
          const endMs = new Date(lastFlag.submittedAt).getTime();
          completionTime = Math.floor((endMs - startMs) / 1000);
          submittedAt = lastFlag.submittedAt;
        }
      }

      let status: 'completed' | 'vm_connected' | 'waiting' = 'waiting';
      if (progress.completed) {
        status = 'completed';
      } else if (progress.stage > 0) {
        status = 'vm_connected';
      }

      return {
        userId: String(userId),
        username,
        status,
        completionTime,
        submittedAt,
        isCompleted: progress.completed || false,
        rank: index + 1,
        score: progress.score || 0,
        stage: progress.stage || 0
      };
    });

    console.log('Participants with scores:', participants.map(p => ({
      username: p.username,
      score: p.score,
      rank: p.rank
    })));

    const totalParticipants = participants.length;
    const completedCount = participants.filter(p => p.isCompleted).length;
    const successRate = totalParticipants > 0 
      ? Math.round((completedCount / totalParticipants) * 100) 
      : 0;

    let winner = null;
    if (arena.winner) {
      const winnerUser = arena.winner as any;
      winner = {
        userId: String(winnerUser._id || arena.winner),
        username: winnerUser.username || 'Unknown',
        solvedAt: arena.firstSolvedAt || null
      };
    }

    const scenarioInfo = arena.scenarioId ? {
      title: (arena.scenarioId as any).title,
      description: (arena.scenarioId as any).description
    } : null;

    const result = {
      _id: String(arena._id),
      name: arena.name,
      host: String((arena.host as any)?._id || arena.host),
      hostName: (arena.host as any)?.username || 'Unknown',
      status: arena.status,
      mode: arena.mode,
      difficulty: arena.difficulty,
      scenario: scenarioInfo,
      maxParticipants: arena.maxParticipants,
      startTime: arena.startTime,
      endTime: arena.endTime,
      timeLimit: arena.timeLimit,
      participants,
      winner,
      firstSolvedAt: arena.firstSolvedAt,
      arenaExp: 0,
      stats: {
        totalParticipants,
        completedCount,
        successRate
      }
    };

    console.log('Final result:', {
      name: result.name,
      mode: result.mode,
      difficulty: result.difficulty,
      participantsCount: result.participants.length,
      winner: result.winner?.username
    });

    res.status(200).json(result);

  } catch (err) {
    console.error('Get arena result error:', err);
    res.status(500).json({ message: 'Failed to fetch arena results' });
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

export const getAllScenarios = async (req: Request, res: Response): Promise<void> => {
  try {
    const scenarios = await ArenaScenario.find()
      .select('-data')
      .sort({ createdAt: -1 });
    
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
    
    if (!mode || !difficulty || !title || !timeLimit || !data) {
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