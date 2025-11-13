// handlers/modes/forensicsRushHandler.ts
import { Server, Socket } from 'socket.io';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import { submitAnswer, getUserProgress } from '../../services/forensicsRush/ForensicsEngine';
import { endArenaProcedure } from '../utils/endArenaProcedure';

export const registerForensicsRushHandlers = (io: Server, socket: Socket) => {
  
  /**
   * 답변 제출
   */
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
      // 1. Arena 상태 확인
      const arena = await Arena.findById(arenaId).populate('scenarioId');
      if (!arena) {
        socket.emit('forensics:error', { message: 'Arena not found' });
        return;
      }
      if (arena.status !== 'started') {
        socket.emit('forensics:error', { message: 'Arena has not started yet' });
        return;
      }

      // 2. 답변 제출 처리 (forensicsEngine 호출)
      const result = await submitAnswer(arenaId, String(userId), questionId, answer);
      
      console.log('📤 Engine Result:', result);

      if (!result.success) {
        socket.emit('forensics:submit-failed', { 
          reason: result.message,
          questionId
        });
        return;
      }

      // 3. 클라이언트에 결과 전송
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

      // 4. 전체 참가자 진행 상황 브로드캐스트
      io.to(arenaId).emit('participant:update', {
        userId: String(userId),
        progress: {
          score: result.totalScore,
          questionsAnswered: result.questionsAnswered,
          questionsCorrect: result.questionsCorrect
        }
      });

      // 5. 모든 문제를 풀었으면 완료 처리
      if (result.allCompleted) {
        console.log(`✅ User ${userId} completed all questions`);
        
        await ArenaProgress.findOneAndUpdate(
          { arena: arenaId, user: userId },
          { $set: { completed: true } }
        );

        // 첫 완료자인지 확인
        if (!arena.winner) {
          console.log(`🏆 Winner detected: ${userId} (first to complete)`);
          
          arena.winner = userId;
          arena.firstSolvedAt = new Date();
          await arena.save();
          
          // 게임 종료 처리
          await endArenaProcedure(arenaId, io);
        }
      }

    } catch (e) {
      console.error('[forensics:submit] error:', e);
      socket.emit('forensics:error', { 
        message: (e as Error).message || 'An error occurred' 
      });
    }
  });

  /**
   * 진행 상황 조회
   */
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

  /**
   * 질문 목록 조회 (ID와 메타데이터만, 정답은 제외)
   */
  socket.on('forensics:get-questions', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    
    console.log('📝 [forensics:get-questions] Request received:', { arenaId, userId });
    
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

      // 질문 목록 (정답 제외)
      const questions = scenarioData.questions.map((q: any) => ({
        id: q.id,
        question: q.question,
        type: q.type,
        points: q.points,
        hints: q.hints || [],
        relatedFiles: q.relatedFiles || [],
        difficulty: q.difficulty
      }));

      // 유저의 답변 상황
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

  /**
   * 시나리오 정보 조회 (배경, 증거 파일, 도구 등)
   */
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

  /**
   * 힌트 요청 (선택적 기능)
   */
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
};