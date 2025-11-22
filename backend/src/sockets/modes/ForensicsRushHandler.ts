// handlers/modes/forensicsRushHandler.ts
import { Server, Socket } from 'socket.io';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import { submitAnswer, getUserProgress } from '../../services/forensicsRush/ForensicsEngine';
import { endArenaProcedure } from '../utils/endArenaProcedure';
import { cancelScheduledEnd } from '../arenaHandlers';

// 유예 시간 타이머 관리
const gracePeriodTimers: Map<string, NodeJS.Timeout> = new Map();
const gracePeriodIntervals: Map<string, NodeJS.Timeout> = new Map();

export const registerForensicsRushHandlers = (io: Server, socket: Socket) => {
  
  // ✅ 이벤트 이름 통일: forensics:submit-answer
  socket.on('forensics:submit-answer', async ({ 
    arenaId,
    questionId, 
    answer 
  }: { 
    arenaId: string;
    questionId: string; 
    answer: string;
  }) => {
    const userId = (socket as any).userId;

    console.log(`\n🔍 [forensics:submit-answer] Arena: ${arenaId}, User: ${userId}`);
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
      console.log('   - Total Score:', result.totalScore);
      console.log('   - All Completed:', result.allCompleted);
      console.log('   - Perfect Score:', result.perfectScore);

      if (!result.success) {
        socket.emit('forensics:error', { 
          message: result.message,
          questionId
        });
        return;
      }

      // ✅ forensics:result 이벤트 발송 (점수는 이미 보너스가 포함된 최종 점수)
      socket.emit('forensics:result', {
        questionId,
        correct: result.correct,
        message: result.message,
        points: result.points,
        penalty: result.penalty,
        totalScore: result.totalScore, // ✅ 최종 점수 (보너스 포함)
        attempts: result.attempts,
        questionsAnswered: result.questionsAnswered,
        questionsCorrect: result.questionsCorrect,
        perfectScore: result.perfectScore,
        allCompleted: result.allCompleted
      });

      // ✅ 참가자 진행 상황 업데이트 브로드캐스트
      io.to(arenaId).emit('participant:update', {
        userId: String(userId),
        progress: {
          score: result.totalScore,
          questionsAnswered: result.questionsAnswered,
          questionsCorrect: result.questionsCorrect
        }
      });

      // ✅ 모든 문제 완료 처리
      if (result.allCompleted) {
        console.log(`✅ User ${userId} completed all questions`);

        // ✅ completionTime 계산 (게임 시작부터 완료까지의 초 단위 시간)
        const arenaDoc = arena as any;
        const startTime = arenaDoc.startTime ? new Date(arenaDoc.startTime).getTime() : Date.now();
        const completedTime = Date.now();
        const completionTimeSeconds = Math.floor((completedTime - startTime) / 1000);

        console.log(`   📊 Completion time: ${completionTimeSeconds} seconds`);

        // ✅ ArenaProgress 업데이트 (completed, completedAt, completionTime, submittedAt 모두 설정)
        const submittedAt = new Date();
        const updatedProgress = await ArenaProgress.findOneAndUpdate(
          { arena: arenaId, user: userId },
          {
            $set: {
              completed: true,
              completedAt: submittedAt,
              submittedAt: submittedAt, // ✅ 추가! (경험치 계산에 필요)
              completionTime: completionTimeSeconds
            }
          },
          { new: true }
        );

        console.log(`   ✅ Progress updated - completed: ${updatedProgress?.completed}`);

        // ✅ 첫 번째 완료자 처리
        if (!arena.winner) {
          console.log(`🏆 First completion detected: ${userId}`);
          
          arena.winner = userId;
          arena.firstSolvedAt = new Date();
          await arena.save();
          
          const GRACE_PERIOD_SECONDS = 180; // 3분
          
          // ✅ 올바른 이벤트 이름: arena:grace-period-started
          io.to(arenaId).emit('arena:grace-period-started', {
            gracePeriodSeconds: GRACE_PERIOD_SECONDS,
            firstWinner: String(userId),
            message: `${userId} completed all questions first! ${GRACE_PERIOD_SECONDS} seconds remaining for others...`
          });
          
          console.log(`⏳ Grace period started: ${GRACE_PERIOD_SECONDS}s`);
          
          // 기존 타이머 정리
          if (gracePeriodTimers.has(arenaId)) {
            clearTimeout(gracePeriodTimers.get(arenaId)!);
            gracePeriodTimers.delete(arenaId);
          }
          if (gracePeriodIntervals.has(arenaId)) {
            clearInterval(gracePeriodIntervals.get(arenaId)!);
            gracePeriodIntervals.delete(arenaId);
          }
          
          // ✅ 유예 시간 카운트다운 (매초마다 업데이트)
          let remainingSeconds = GRACE_PERIOD_SECONDS;
          const countdownInterval = setInterval(() => {
            remainingSeconds--;
            
            if (remainingSeconds > 0) {
              io.to(arenaId).emit('arena:grace-period-update', {
                remainingSeconds
              });
            }
          }, 1000);
          
          gracePeriodIntervals.set(arenaId, countdownInterval);
          
          // ✅ 유예 시간 종료 타이머
          const endTimer = setTimeout(async () => {
            console.log(`⏰ Grace period ended for arena ${arenaId}`);

            // 타이머 정리
            gracePeriodTimers.delete(arenaId);
            if (gracePeriodIntervals.has(arenaId)) {
              clearInterval(gracePeriodIntervals.get(arenaId)!);
              gracePeriodIntervals.delete(arenaId);
            }

            cancelScheduledEnd(arenaId);

            try {
              // ✅ endArenaProcedure 호출하여 경험치 계산 및 게임 종료
              await endArenaProcedure(arenaId, io);
              console.log('✅ [ForensicsRush] Arena ended with EXP calculation');

            } catch (error) {
              console.error('❌ [ForensicsRush] Error ending arena:', error);
            }
          }, GRACE_PERIOD_SECONDS * 1000);
          
          gracePeriodTimers.set(arenaId, endTimer);
          
        } else {
          // 추가 완료자
          console.log(`✅ User ${userId} also completed (not first)`);
          
          io.to(arenaId).emit('forensics:user-completed', {
            userId: String(userId),
            score: result.totalScore
          });

          // ✅ 모든 참가자가 완료했는지 확인
          await checkAllParticipantsCompleted(arenaId, io);
        }
      }

    } catch (e) {
      console.error('[forensics:submit-answer] error:', e);
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
      console.log('   - Score:', progress.score);
      console.log('   - Questions Correct:', progress.questionsCorrect);

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
    
    console.log('📋 [forensics:get-questions] Request received:', { arenaId, userId });
    
    if (!arenaId || !userId) {
      console.warn('⚠️ [forensics:get-questions] Missing arenaId or userId');
      return;
    }

    try {
      const arena = await Arena.findById(arenaId)
        .select('scenarioId')
        .populate('scenarioId');
      
      if (!arena || !arena.scenarioId) {
        socket.emit('forensics:questions-data', { questions: [], answeredQuestions: [] });
        return;
      }

      const scenario = arena.scenarioId as any;
      const scenarioData = scenario.data;

      // 답변이 포함되지 않은 질문 정보만 전송
      const questionsWithoutAnswers = scenarioData.questions.map((q: any) => ({
        id: q.id,
        question: q.question,
        type: q.type,
        points: q.points,
        hints: q.hints || [],
        difficulty: q.difficulty,
        relatedFiles: q.relatedFiles || []
      }));

      // 유저의 답변 기록 가져오기
      const progressDoc = await ArenaProgress.findOne({ 
        arena: arenaId, 
        user: userId 
      }).lean();

      const answeredQuestions = progressDoc?.forensicsRush?.answers?.map((a: any) => ({
        questionId: a.questionId,
        correct: a.correct,
        attempts: a.attempts || 1
      })) || [];

      socket.emit('forensics:questions-data', {
        questions: questionsWithoutAnswers,
        answeredQuestions
      });

      console.log('📤 [forensics:get-questions] Sent questions to client');

    } catch (e) {
      console.error('[forensics:get-questions] error:', e);
      socket.emit('forensics:questions-data', { questions: [], answeredQuestions: [] });
    }
  });

  socket.on('forensics:get-scenario', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    
    console.log('🎬 [forensics:get-scenario] Request received:', { arenaId, userId });
    
    if (!arenaId || !userId) {
      console.warn('⚠️ [forensics:get-scenario] Missing arenaId or userId');
      return;
    }

    try {
      const arena = await Arena.findById(arenaId)
        .select('scenarioId')
        .populate('scenarioId');
      
      if (!arena || !arena.scenarioId) {
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

  // ✅ 새로운 핸들러: 게임 상태 조회
  socket.on('forensics:get-game-state', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    
    console.log('🎮 [forensics:get-game-state] Request received:', { arenaId, userId });
    
    if (!arenaId || !userId) {
      console.warn('⚠️ [forensics:get-game-state] Missing arenaId or userId');
      return;
    }

    try {
      const arena = await Arena.findById(arenaId);
      
      if (!arena) {
        console.error('❌ [forensics:get-game-state] Arena not found');
        socket.emit('forensics:game-state', {
          gameTimeRemaining: null,
          gracePeriodRemaining: null,
          firstWinner: null,
          isEnded: false
        });
        return;
      }

      const arenaDoc = arena as any;

      // 게임 시간 계산 (ForensicsRush는 시간 제한 없음)
      let gameTimeRemaining: number | null = null;
      
      // ✅ ForensicsRush는 타이머 없음
      if (arena.mode !== 'FORENSICS_RUSH' && arenaDoc.startTime && arena.status === 'started') {
        const GAME_DURATION_MS = (arena as any).timeLimit * 60 * 1000; // timeLimit은 분 단위
        const elapsedMs = Date.now() - new Date(arenaDoc.startTime).getTime();
        const remainingMs = GAME_DURATION_MS - elapsedMs;
        gameTimeRemaining = remainingMs > 0 ? Math.floor(remainingMs / 1000) : 0;
      }

      // 유예 시간 계산
      let gracePeriodRemaining: number | null = null;
      if (arena.winner && arenaDoc.firstSolvedAt) {
        const GRACE_PERIOD_MS = 180 * 1000; // 3분
        const elapsedMs = Date.now() - new Date(arenaDoc.firstSolvedAt).getTime();
        const remainingMs = GRACE_PERIOD_MS - elapsedMs;
        gracePeriodRemaining = remainingMs > 0 ? Math.floor(remainingMs / 1000) : 0;
      }

      socket.emit('forensics:game-state', {
        gameTimeRemaining,
        gracePeriodRemaining,
        firstWinner: arena.winner ? String(arena.winner) : null,
        isEnded: arena.status === 'ended'
      });

      console.log('📤 [forensics:get-game-state] Sent game state to client');

    } catch (e) {
      console.error('[forensics:get-game-state] error:', e);
      socket.emit('forensics:game-state', {
        gameTimeRemaining: null,
        gracePeriodRemaining: null,
        firstWinner: null,
        isEnded: false
      });
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
    if (arenaId) {
      if (gracePeriodTimers.has(arenaId)) {
        console.log(`🧹 Cleaning up grace period timer for arena ${arenaId}`);
      }
      if (gracePeriodIntervals.has(arenaId)) {
        console.log(`🧹 Cleaning up grace period interval for arena ${arenaId}`);
      }
    }
  });
};

// ✅ 모든 참가자 완료 체크
async function checkAllParticipantsCompleted(arenaId: string, io: Server) {
  try {
    console.log(`\n🔍 [checkAllParticipantsCompleted] Checking arena ${arenaId}`);

    const arena = await Arena.findById(arenaId);
    if (!arena) {
      console.log(`   ❌ Arena not found`);
      return;
    }

    const totalParticipants = arena.participants?.length || 0;
    if (totalParticipants === 0) {
      console.log(`   ⚠️ No participants in arena`);
      return;
    }

    console.log(`   📋 Total participants: ${totalParticipants}`);

    // 모든 ArenaProgress 문서 조회하여 확인
    const allProgress = await ArenaProgress.find({ arena: arenaId }).lean();
    console.log(`   📄 Found ${allProgress.length} progress documents`);
    allProgress.forEach((p: any) => {
      console.log(`      - User ${p.user}: completed=${p.completed}, score=${p.score}`);
    });

    const completedCount = await ArenaProgress.countDocuments({
      arena: arenaId,
      completed: true
    });

    console.log(`   📊 Completion check: ${completedCount}/${totalParticipants} participants completed`);

    if (completedCount >= totalParticipants) {
      console.log(`   🎯 All participants completed! Ending arena immediately.`);
      
      // 타이머 정리
      if (gracePeriodTimers.has(arenaId)) {
        clearTimeout(gracePeriodTimers.get(arenaId)!);
        gracePeriodTimers.delete(arenaId);
        console.log(`ℹ️ Grace period timer cancelled`);
      }
      if (gracePeriodIntervals.has(arenaId)) {
        clearInterval(gracePeriodIntervals.get(arenaId)!);
        gracePeriodIntervals.delete(arenaId);
        console.log(`ℹ️ Grace period interval cancelled`);
      }

      cancelScheduledEnd(arenaId);

      try {
        // ✅ 모든 참가자 완료 알림
        io.to(arenaId).emit('forensics:all-completed', {
          message: 'All participants have completed! Ending game now...'
        });

        // ✅ endArenaProcedure 호출하여 경험치 계산 및 게임 종료
        await endArenaProcedure(arenaId, io);
        console.log('✅ [ForensicsRush] Arena ended with EXP calculation (all completed)');

      } catch (error) {
        console.error('❌ [ForensicsRush] Error ending arena:', error);
      }
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
  if (gracePeriodIntervals.has(arenaId)) {
    clearInterval(gracePeriodIntervals.get(arenaId)!);
    gracePeriodIntervals.delete(arenaId);
    console.log(`🧹 Cleared grace period interval for arena ${arenaId}`);
  }
};

// ✅ Forensics Rush 초기화 함수
export const initializeForensicsRush = async (arenaId: string) => {
  try {
    console.log(`🎯 [initializeForensicsRush] Initializing arena ${arenaId}`);

    const arena = await Arena.findById(arenaId).populate('participants.user');
    if (!arena) {
      console.error(`❌ [initializeForensicsRush] Arena ${arenaId} not found`);
      return;
    }

    // 모든 참가자에 대해 ArenaProgress 생성
    for (const participant of arena.participants) {
      const userId = String((participant.user as any)?._id ?? participant.user);

      // ArenaProgress가 없으면 생성
      const existingProgress = await ArenaProgress.findOne({
        arena: arenaId,
        user: userId
      });

      if (!existingProgress) {
        await ArenaProgress.create({
          arena: arenaId,
          user: userId,
          mode: 'forensics-rush',
          completed: false,
          forensicsRush: {
            score: 0,
            questionsAnswered: 0,
            questionsCorrect: 0,
            totalAttempts: 0,
            penalties: 0,
            answers: []
          }
        });
        console.log(`✅ [initializeForensicsRush] Created progress for user ${userId}`);
      }
    }

    console.log(`✅ [initializeForensicsRush] Arena ${arenaId} initialized successfully`);
  } catch (error) {
    console.error(`❌ [initializeForensicsRush] Error:`, error);
    throw error;
  }
};