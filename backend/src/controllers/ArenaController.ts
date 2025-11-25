import { Request, Response } from 'express';
import Arena from '../models/Arena';
import ArenaProgress from '../models/ArenaProgress';
import ArenaScenario from '../models/ArenaScenario';
import { ArenaScenarioService } from '../services/ArenaScenarioService';
import { generateVulnerableHTML } from '../services/vulnerbilityScannerRace/generateVulnerableHTML';

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
      'VULNERABILITY_SCANNER_RACE',                   
      'FORENSICS_RUSH',                  
      'SOCIAL_ENGINEERING_CHALLENGE'     
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

    if (mode === 'VULNERABILITY_SCANNER_RACE') {
      if (maxParticipants !== 2) {
        res.status(400).json({
          message: 'Vulnerability Scanner Race는 정확히 2명의 참가자가 필요합니다.'
        });
        return;
      }
    }

    if (mode === 'SOCIAL_ENGINEERING_CHALLENGE') {
      if (maxParticipants < 1 || maxParticipants > 4) {
        res.status(400).json({
          message: 'Social Engineering은 1-4명의 참가자만 지원합니다.'
        });
        return;
      }
    }

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

    // ✅ 유예시간은 endArenaProcedure에서 동적으로 계산 (남은 시간의 1/2)
    const newArena = await Arena.create({
      name,
      mode,
      difficulty,
      host: userId,
      maxParticipants,
      scenarioId: scenario._id,
      timeLimit: scenario.timeLimit,
      participants: [{ user: userId, isReady: false, hasLeft: false }],
      status: 'waiting',
      settings: {
        endOnFirstSolve: mode === 'VULNERABILITY_SCANNER_RACE' ? true : false
        // graceMs는 더 이상 사용하지 않음 - 동적 계산으로 변경됨
      }
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
      .populate('participants.user', '_id username')
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
            completed: p.completed || false,
            expEarned: p.expEarned || 0  // ✨ 경험치 추가
          })),
          myRank,
          myScore: progress.score || 0,
          myCompleted: progress.completed || false,
          myExpEarned: progress.expEarned || 0  // ✨ 내 경험치 추가
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

    const progressDocs = await ArenaProgress.find({ arena: arenaId })
      .populate('user', 'username')
      .lean();

    console.log(`📋 [getArenaResult] Found ${progressDocs.length} participants`);

    const participants = progressDocs.map((progress: any) => {
      const baseData = {
        userId: String(progress.user._id),
        username: progress.user.username,
        status: progress.completed ? 'completed' : (progress.score > 0 ? 'vm_connected' : 'waiting'),
        completionTime: progress.completionTime || null,
        submittedAt: progress.submittedAt || null,
        isCompleted: progress.completed || false,
        rank: 0,
        score: progress.score || 0,
        expEarned: progress.expEarned || 0,
        coinsEarned: progress.coinsEarned || 0  // 💰 코인 추가
      };

      switch (arena.mode) {
        case 'TERMINAL_HACKING_RACE':
          return {
            ...baseData,
            stage: progress.stage || 0,
            flags: progress.flags || []
          };

        case 'VULNERABILITY_SCANNER_RACE':  
          return {
            ...baseData,
            vulnerabilitiesFound: progress.vulnerabilityScannerRace?.vulnerabilitiesFound || 0,
            firstBloods: progress.vulnerabilityScannerRace?.firstBloods || 0,
            invalidSubmissions: progress.vulnerabilityScannerRace?.invalidSubmissions || 0
          };

        case 'FORENSICS_RUSH':
          const scenarioData = (arena.scenarioId as any)?.data;
          const totalQuestions = scenarioData?.totalQuestions || scenarioData?.questions?.length || 0;
          return {
            ...baseData,
            questionsAnswered: progress.forensicsRush?.questionsAnswered || 0,
            questionsCorrect: progress.forensicsRush?.questionsCorrect || 0,
            totalAttempts: progress.forensicsRush?.totalAttempts || 0,
            penalties: progress.forensicsRush?.penalties || 0,
            totalQuestions
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

    participants.sort((a, b) => {
      if (a.isCompleted && !b.isCompleted) return -1;
      if (!a.isCompleted && b.isCompleted) return 1;
      
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
      
      if (a.score !== b.score) return b.score - a.score;
      
      return 0;
    });

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

    const completedCount = participants.filter(p => p.isCompleted).length;
    const totalParticipants = participants.length;
    const successRate = totalParticipants > 0 
      ? Math.round((completedCount / totalParticipants) * 100) 
      : 0;

    let duration = 0;
    if (arena.startTime && arena.endTime) {
      duration = Math.floor(
        (new Date(arena.endTime).getTime() - new Date(arena.startTime).getTime()) / 1000
      );
    }

    let winner = null;
    if (arena.winner) {
      const winnerDoc = arena.winner as any;
      winner = {
        userId: String(winnerDoc._id),
        username: winnerDoc.username,
        solvedAt: arena.firstSolvedAt || null
      };
    }

    const modeMapping: { [key: string]: string } = {
      'TERMINAL_HACKING_RACE': 'terminal-race',
      'VULNERABILITY_SCANNER_RACE': 'vulnerability-scanner-race',  
      'FORENSICS_RUSH': 'forensics-rush',
      'SOCIAL_ENGINEERING_CHALLENGE': 'social-engineering'
    };

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
    console.log('📥 [createScenario] Request received');
    console.log('📥 [createScenario] Body:', JSON.stringify(req.body, null, 2));

    const { mode, difficulty, title, description, timeLimit, data } = req.body;

    if (!mode || !difficulty || !title || !data) {
      console.warn('⚠️ [createScenario] Missing required fields');
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    // VULNERABILITY_SCANNER_RACE: 난이도 기반 모드 검증
    if (mode === 'VULNERABILITY_SCANNER_RACE') {
      const isEasyOrMedium = difficulty === 'EASY' || difficulty === 'MEDIUM';
      const isHardOrExpert = difficulty === 'HARD' || difficulty === 'EXPERT';

      // EASY/MEDIUM: SIMULATED 모드 강제, features 필수
      if (isEasyOrMedium) {
        if (data.mode !== 'SIMULATED') {
          res.status(400).json({
            message: 'EASY and MEDIUM difficulties must use SIMULATED mode (AI-generated HTML)'
          });
          return;
        }

        if (!data.features || data.features.length === 0) {
          res.status(400).json({
            message: 'Features are required for SIMULATED mode (EASY/MEDIUM difficulty)'
          });
          return;
        }

        // targetUrl 강제 초기화
        data.targetUrl = '';
      }

      // HARD/EXPERT: REAL 모드 강제, targetUrl 필수
      if (isHardOrExpert) {
        if (data.mode !== 'REAL') {
          res.status(400).json({
            message: 'HARD and EXPERT difficulties must use REAL mode (actual URL)'
          });
          return;
        }

        if (!data.targetUrl || !data.targetUrl.trim()) {
          res.status(400).json({
            message: 'Target URL is required for REAL mode (HARD/EXPERT difficulty)'
          });
          return;
        }

        // URL 형식 검증
        try {
          new URL(data.targetUrl);
        } catch (error) {
          res.status(400).json({
            message: 'Target URL must be a valid URL (e.g., https://example.com)'
          });
          return;
        }
      }
    }

    // VulnerabilityScannerRace이고 SIMULATED 모드면 HTML 생성
    let scenarioData = data;
    if (mode === 'VULNERABILITY_SCANNER_RACE' && data.mode === 'SIMULATED') {
      console.log('🤖 [createScenario] Generating vulnerable HTML with Claude AI...');

      try {
        const generatedHTML = await generateVulnerableHTML({
          title,
          difficulty,
          data
        } as any);

        // data에 generatedHTML 추가
        scenarioData = {
          ...data,
          generatedHTML
        };

        console.log(`✅ [createScenario] HTML generated (${generatedHTML.length} characters)`);
      } catch (htmlError) {
        console.error('❌ [createScenario] Failed to generate HTML:', htmlError);
        res.status(500).json({ message: 'Failed to generate vulnerable HTML' });
        return;
      }
    }

    const scenario = await ArenaScenario.create({
      mode,
      difficulty,
      title,
      description,
      timeLimit,
      data: scenarioData,
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

    // VULNERABILITY_SCANNER_RACE: 난이도 기반 모드 검증
    if (updates.mode === 'VULNERABILITY_SCANNER_RACE' && updates.difficulty && updates.data) {
      const isEasyOrMedium = updates.difficulty === 'EASY' || updates.difficulty === 'MEDIUM';
      const isHardOrExpert = updates.difficulty === 'HARD' || updates.difficulty === 'EXPERT';

      // EASY/MEDIUM: SIMULATED 모드 강제, features 필수
      if (isEasyOrMedium) {
        if (updates.data.mode !== 'SIMULATED') {
          res.status(400).json({
            message: 'EASY and MEDIUM difficulties must use SIMULATED mode (AI-generated HTML)'
          });
          return;
        }

        if (!updates.data.features || updates.data.features.length === 0) {
          res.status(400).json({
            message: 'Features are required for SIMULATED mode (EASY/MEDIUM difficulty)'
          });
          return;
        }

        // targetUrl 강제 초기화
        updates.data.targetUrl = '';
      }

      // HARD/EXPERT: REAL 모드 강제, targetUrl 필수
      if (isHardOrExpert) {
        if (updates.data.mode !== 'REAL') {
          res.status(400).json({
            message: 'HARD and EXPERT difficulties must use REAL mode (actual URL)'
          });
          return;
        }

        if (!updates.data.targetUrl || !updates.data.targetUrl.trim()) {
          res.status(400).json({
            message: 'Target URL is required for REAL mode (HARD/EXPERT difficulty)'
          });
          return;
        }

        // URL 형식 검증
        try {
          new URL(updates.data.targetUrl);
        } catch (error) {
          res.status(400).json({
            message: 'Target URL must be a valid URL (e.g., https://example.com)'
          });
          return;
        }
      }
    }

    // VulnerabilityScannerRace이고 data가 변경되었으며 SIMULATED 모드면 HTML 재생성
    let finalUpdates = updates;
    if (updates.mode === 'VULNERABILITY_SCANNER_RACE' && updates.data?.mode === 'SIMULATED') {
      console.log('🤖 [updateScenario] Regenerating vulnerable HTML with Claude AI...');

      try {
        const generatedHTML = await generateVulnerableHTML({
          title: updates.title,
          difficulty: updates.difficulty,
          data: updates.data
        } as any);

        // data에 generatedHTML 추가
        finalUpdates = {
          ...updates,
          data: {
            ...updates.data,
            generatedHTML
          }
        };

        console.log(`✅ [updateScenario] HTML regenerated (${generatedHTML.length} characters)`);
      } catch (htmlError) {
        console.error('❌ [updateScenario] Failed to regenerate HTML:', htmlError);
        res.status(500).json({ message: 'Failed to regenerate vulnerable HTML' });
        return;
      }
    }

    const scenario = await ArenaScenario.findByIdAndUpdate(
      id,
      finalUpdates,
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