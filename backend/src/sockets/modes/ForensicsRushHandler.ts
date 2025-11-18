// handlers/modes/forensicsRushHandler.ts
import { Server, Socket } from 'socket.io';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import { submitAnswer, getUserProgress } from '../../services/forensicsRush/ForensicsEngine';
import { endArenaProcedure } from '../utils/endArenaProcedure';
import { cancelScheduledEnd } from '../arenaHandlers';

// 유예 시간 타이머 관리
const gracePeriodTimers: Map<string, NodeJS.Timeout> = new Map();

export const registerForensicsRushHandlers = (io: Server, socket: Socket) => {
  
  socket.on('forensics:submit', async ({ 
    questionId, 
    answer 
  }: { 
    questionId: string; 
    answer: string;
  }) => {
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;

    console.log(`\n🔍 [forensics:submit] Arena: ${arenaId}, User: ${userId}`);
    console.log(`   Question: ${questionId}, Answer: "${answer}"`);

    if (!arenaId || !userId) {
      socket.emit('forensics:error', { message: 'Invalid request: missing arenaId or userId' });
      return;
    }

    if (!questionId || !answer || answer.trim().length === 0) {
      socket.emit('forensics:error', { message: 'Question ID and answer are required' });
      return;
    }

    try {
      const arena = await Arena.findById(arenaId).populate('scenarioId');
      if (!arena) {
        socket.emit('forensics:error', { message: 'Arena not found' });
        return;
      }
      if (arena.status !== 'started') {
        socket.emit('forensics:error', { message: 'Arena has not started yet' });
        return;
      }

      const result = await submitAnswer(arenaId, String(userId), questionId, answer);
      
      console.log('📤 Engine Result:', result);

      if (!result.success) {
        socket.emit('forensics:submit-failed', { 
          reason: result.message,
          questionId
        });
        return;
      }

      socket.emit('forensics:result', {
        questionId,
        correct: result.correct,
        message: result.message,
        points: result.points,
        penalty: result.penalty,
        totalScore: result.totalScore,
        attempts: result.attempts,
        questionsAnswered: result.questionsAnswered,
        questionsCorrect: result.questionsCorrect,
        perfectScore: result.perfectScore,
        allCompleted: result.allCompleted
      });

      io.to(arenaId).emit('participant:update', {
        userId: String(userId),
        progress: {
          score: result.totalScore,
          questionsAnswered: result.questionsAnswered,
          questionsCorrect: result.questionsCorrect
        }
      });

      if (result.allCompleted) {
        console.log(`✅ User ${userId} completed all questions`);
        
        await ArenaProgress.findOneAndUpdate(
          { arena: arenaId, user: userId },
          { $set: { completed: true, completedAt: new Date() } }
        );

        if (!arena.winner) {
          console.log(`🏆 First completion detected: ${userId}`);
          
          arena.winner = userId;
          arena.firstSolvedAt = new Date();
          await arena.save();
          
          const GRACE_PERIOD_MS = 180000;
          
          io.to(arenaId).emit('forensics:first-completion', {
            winner: String(userId),
            gracePeriodMs: GRACE_PERIOD_MS,
            message: `${userId} completed all questions first! ${GRACE_PERIOD_MS / 1000} seconds remaining for others...`
          });
          
          console.log(`⏳ Grace period started: ${GRACE_PERIOD_MS}ms (${GRACE_PERIOD_MS / 1000}s)`);
          
          if (gracePeriodTimers.has(arenaId)) {
            clearTimeout(gracePeriodTimers.get(arenaId)!);
          }
          
          const timer = setTimeout(async () => {
            console.log(`⏰ Grace period ended for arena ${arenaId}`);
            gracePeriodTimers.delete(arenaId);
            cancelScheduledEnd(arenaId);
            await endArenaProcedure(arenaId, io);
          }, GRACE_PERIOD_MS);
          
          gracePeriodTimers.set(arenaId, timer);
          
        } else {
          console.log(`✅ User ${userId} also completed (not first)`);
          
          io.to(arenaId).emit('forensics:user-completed', {
            userId: String(userId),
            score: result.totalScore
          });

          await checkAllParticipantsCompleted(arenaId, io);
        }
      }

    } catch (e) {
      console.error('[forensics:submit] error:', e);
      socket.emit('forensics:error', { 
        message: (e as Error).message || 'An error occurred' 
      });
    }
  });

  socket.on('forensics:get-progress', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    
    console.log('📊 [forensics:get-progress] Request received:', { arenaId, userId });
    
    if (!arenaId || !userId) {
      console.warn('⚠️ [forensics:get-progress] Missing arenaId or userId');
      return;
    }

    try {
      const progress = await getUserProgress(arenaId, userId);
      
      if (!progress) {
        socket.emit('forensics:progress-data', {
          score: 0,
          questionsAnswered: 0,
          questionsCorrect: 0,
          totalAttempts: 0,
          penalties: 0,
          answers: [],
          totalQuestions: 0
        });
        return;
      }

      socket.emit('forensics:progress-data', progress);
      console.log('📤 [forensics:get-progress] Sent progress to client');

    } catch (e) {
      console.error('[forensics:get-progress] error:', e);
      socket.emit('forensics:progress-data', {
        score: 0,
        questionsAnswered: 0,
        questionsCorrect: 0,
        totalAttempts: 0,
        penalties: 0,
        answers: [],
        totalQuestions: 0
      });
    }
  });

  socket.on('forensics:get-questions', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    
    console.log('🔍 [forensics:get-questions] Request received:', { arenaId, userId });
    
    if (!arenaId || !userId) {
      console.warn('⚠️ [forensics:get-questions] Missing arenaId or userId');
      return;
    }

    try {
      const arena = await Arena.findById(arenaId)
        .select('scenarioId')
        .populate('scenarioId');
      
      if (!arena || !arena.scenarioId) {
        console.error('❌ [forensics:get-questions] Arena or scenario not found');
        socket.emit('forensics:questions-data', { questions: [] });
        return;
      }

      console.log('✅ [forensics:get-questions] Arena found:', arena._id);

      const scenario = arena.scenarioId as any;
      const scenarioData = scenario.data;

      const questions = scenarioData.questions.map((q: any) => ({
        id: q.id,
        question: q.question,
        type: q.type,
        points: q.points,
        hints: q.hints || [],
        relatedFiles: q.relatedFiles || [],
        difficulty: q.difficulty
      }));

      const progressDoc = await ArenaProgress.findOne({ 
        arena: arenaId, 
        user: userId 
      }).lean();

      const answeredQuestions = progressDoc?.forensicsRush?.answers || [];

      socket.emit('forensics:questions-data', { 
        questions,
        answeredQuestions: answeredQuestions.map((a: any) => ({
          questionId: a.questionId,
          correct: a.correct,
          attempts: a.attempts
        }))
      });

      console.log('📤 [forensics:get-questions] Sent questions to client');

    } catch (e) {
      console.error('[forensics:get-questions] error:', e);
      socket.emit('forensics:questions-data', { questions: [] });
    }
  });

  socket.on('forensics:get-scenario', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    
    console.log('📋 [forensics:get-scenario] Request received:', { arenaId, userId });
    
    if (!arenaId || !userId) {
      console.warn('⚠️ [forensics:get-scenario] Missing arenaId or userId');
      return;
    }

    try {
      const arena = await Arena.findById(arenaId)
        .select('scenarioId')
        .populate('scenarioId');
      
      if (!arena || !arena.scenarioId) {
        console.error('❌ [forensics:get-scenario] Arena or scenario not found');
        socket.emit('forensics:scenario-data', { scenario: null });
        return;
      }

      const scenario = arena.scenarioId as any;
      const scenarioData = scenario.data;

      socket.emit('forensics:scenario-data', {
        scenario: {
          title: scenarioData.scenario.title,
          description: scenarioData.scenario.description,
          incidentType: scenarioData.scenario.incidentType,
          date: scenarioData.scenario.date,
          context: scenarioData.scenario.context
        },
        evidenceFiles: scenarioData.evidenceFiles || [],
        availableTools: scenarioData.availableTools || [],
        totalQuestions: scenarioData.totalQuestions || scenarioData.questions.length
      });

      console.log('📤 [forensics:get-scenario] Sent scenario data to client');

    } catch (e) {
      console.error('[forensics:get-scenario] error:', e);
      socket.emit('forensics:scenario-data', { scenario: null });
    }
  });

  socket.on('forensics:get-hint', async ({ 
    arenaId, 
    questionId 
  }: { 
    arenaId: string; 
    questionId: string;
  }) => {
    const userId = (socket as any).userId;
    
    console.log('💡 [forensics:get-hint] Request received:', { arenaId, userId, questionId });
    
    if (!arenaId || !userId || !questionId) {
      console.warn('⚠️ [forensics:get-hint] Missing parameters');
      return;
    }

    try {
      const arena = await Arena.findById(arenaId)
        .select('scenarioId')
        .populate('scenarioId');
      
      if (!arena || !arena.scenarioId) {
        socket.emit('forensics:hint-data', { hints: [] });
        return;
      }

      const scenario = arena.scenarioId as any;
      const scenarioData = scenario.data;

      const question = scenarioData.questions.find((q: any) => q.id === questionId);
      
      if (!question) {
        socket.emit('forensics:hint-data', { hints: [] });
        return;
      }

      socket.emit('forensics:hint-data', {
        questionId,
        hints: question.hints || []
      });

      console.log('📤 [forensics:get-hint] Sent hints to client');

    } catch (e) {
      console.error('[forensics:get-hint] error:', e);
      socket.emit('forensics:hint-data', { hints: [] });
    }
  });

  socket.on('disconnect', () => {
    const arenaId = (socket as any).arenaId;
    if (arenaId && gracePeriodTimers.has(arenaId)) {
      console.log(`🧹 Cleaning up grace period timer for arena ${arenaId}`);
    }
  });
};

async function checkAllParticipantsCompleted(arenaId: string, io: Server) {
  try {
    const arena = await Arena.findById(arenaId);
    if (!arena) return;

    const totalParticipants = arena.participants?.length || 0;
    if (totalParticipants === 0) return;

    const completedCount = await ArenaProgress.countDocuments({
      arena: arenaId,
      completed: true
    });

    console.log(`📊 Completion check: ${completedCount}/${totalParticipants} participants completed`);

    if (completedCount >= totalParticipants) {
      console.log(`🎯 All participants completed! Ending arena immediately.`);
      
      if (gracePeriodTimers.has(arenaId)) {
        clearTimeout(gracePeriodTimers.get(arenaId)!);
        gracePeriodTimers.delete(arenaId);
        console.log(`ℹ️ Grace period timer cancelled`);
      }

      cancelScheduledEnd(arenaId);

      io.to(arenaId).emit('forensics:all-completed', {
        message: 'All participants have completed! Ending game now...'
      });

      await endArenaProcedure(arenaId, io);
    }
  } catch (error) {
    console.error('[checkAllParticipantsCompleted] error:', error);
  }
}

export const clearGracePeriodTimer = (arenaId: string) => {
  if (gracePeriodTimers.has(arenaId)) {
    clearTimeout(gracePeriodTimers.get(arenaId)!);
    gracePeriodTimers.delete(arenaId);
    console.log(`🧹 Cleared grace period timer for arena ${arenaId}`);
  }
};