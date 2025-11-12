import { Server, Socket } from 'socket.io';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import { terminalProcessCommand } from '../../services/terminalRace/terminalEngine';
import { endArenaProcedure } from '../utils/endArenaProcedure';

export const registerTerminalRaceHandlers = (io: Server, socket: Socket) => {
  socket.on('terminal:execute', async ({ 
    command 
  }: { command: string }) => {
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;

    console.log(`\n🎮 [terminal:execute] Arena: ${arenaId}, User: ${userId}`);
    console.log(`   Command: "${command}"`);

    if (!arenaId || !userId) {
      socket.emit('terminal:error', { message: 'Invalid request: missing arenaId or userId' });
      return;
    }

    try {
      // 1. Arena 상태 확인 (시나리오 정보 포함)
      const arena = await Arena.findById(arenaId).populate('scenarioId');
      if (!arena) {
        socket.emit('terminal:error', { message: 'Arena not found' });
        return;
      }
      if (arena.status !== 'started') {
        socket.emit('terminal:error', { message: 'Arena has not started yet' });
        return;
      }

      // 2. 명령어 처리 (terminalEngine 호출)
      const result = await terminalProcessCommand(arenaId, String(userId), command);
      
      console.log('📤 Engine Result:', result);

      // 3. 진행 상황 업데이트
      const updatePayload: any = {};
      
      if (result.progressDelta && result.progressDelta > 0) {
        updatePayload.$inc = { score: result.progressDelta };
      }
      
      if (result.advanceStage) {
        // 스테이지 진행
        const currentProgress = await ArenaProgress.findOne({ arena: arenaId, user: userId });
        const currentStage = currentProgress?.stage || 0;
        const newStage = currentStage + 1;
        
        console.log(`🎯 Stage advancement: ${currentStage} → ${newStage}`);
        
        updatePayload.$set = { stage: newStage };
        
        // 시나리오 확인
        const scenario = arena.scenarioId as any;
        const totalStages = scenario?.data?.totalStages || 0;
        
        if (newStage >= totalStages) {
          console.log('🏆 All stages completed!');
          updatePayload.$set.completed = true;
        }
      };
      
      if (result.flagFound) {
        updatePayload.$set = { completed: true };
      }

      console.log('📝 Update Payload:', JSON.stringify(updatePayload, null, 2));

      // 4. ArenaProgress 업데이트
      const progressDoc = await ArenaProgress.findOneAndUpdate(
        { arena: arenaId, user: userId },
        updatePayload,
        { 
          upsert: true, 
          new: true, 
          setDefaultsOnInsert: true
        }
      );
      
      console.log('✅ After Progress:', {
        userId,
        stage: progressDoc.stage,
        score: progressDoc.score,
        completed: progressDoc.completed
      });
      console.log('---\n');
      
      // 5. 클라이언트에 결과 전송 (프론트엔드가 기대하는 필드명으로)
      io.to(arenaId).emit('terminal:result', {
        userId,
        command,
        message: result.message,
        scoreGain: result.progressDelta,        // ✅ scoreGain으로 전송
        stageAdvanced: result.advanceStage,     // ✅ stageAdvanced 추가
        currentStage: progressDoc.stage,        // ✅ currentStage로 전송
        totalScore: progressDoc.score,          // ✅ totalScore 추가
        completed: progressDoc.completed
      });

      // ✅ 전체 참가자 진행 상황 브로드캐스트
      io.to(arenaId).emit('participant:update', {
        userId: String(userId),
        progress: {
          score: progressDoc.score,
          stage: progressDoc.stage,
          completed: progressDoc.completed
        }
      });
      
      // 6. 게임 종료 처리
      // 모든 스테이지 완료 시 게임 종료
      if (progressDoc.completed && !arena.winner) {
        console.log(`🏆 Winner detected: ${userId} (completed all stages)`);
        
        // Arena 모델에 승자 기록
        arena.winner = userId;
        arena.firstSolvedAt = new Date();
        await arena.save();
        
        // 즉시 게임 종료
        await endArenaProcedure(arenaId, io);
      }
      // 또는 flagFound로 게임 종료
      else if (result.flagFound && !arena.winner) {
        console.log(`🏆 Winner detected: ${userId} (flag found)`);
        
        arena.winner = userId;
        arena.firstSolvedAt = new Date();
        await arena.save();
        
        await endArenaProcedure(arenaId, io);
      }

    } catch (e) {
      console.error('[terminal:execute] error:', e);
      socket.emit('arena:action-failed', { 
        reason: (e as Error).message || 'An error occurred' 
      });
    }
  });

  // ✅ 진행 상황 조회 개선
  socket.on('terminal:get-progress', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    if (!arenaId || !userId) return;

    try {
      // Arena에서 시나리오 정보 가져오기
      const arena = await Arena.findById(arenaId)
        .select('scenarioId')
        .populate('scenarioId');
      
      const scenario = arena?.scenarioId as any;
      const totalStages = scenario?.data?.totalStages || scenario?.data?.stages?.length || 0;
      
      // ArenaProgress에서 현재 유저의 진행 상황 조회
      const progressDoc = await ArenaProgress.findOne({ 
        arena: arenaId, 
        user: userId 
      }).lean();

      // 진행 상황이 없으면 초기 상태 반환
      if (!progressDoc) {
        socket.emit('terminal:progress-data', {
          stage: 0,
          score: 0,
          completed: false,
          flags: [],
          totalStages: totalStages
        });
        return;
      }

      // 진행 상황 반환
      socket.emit('terminal:progress-data', {
        stage: progressDoc.stage || 0,
        score: progressDoc.score || 0,
        completed: progressDoc.completed || false,
        flags: progressDoc.flags || [],
        totalStages: totalStages
      });

    } catch (e) {
      console.error('[terminal:get-progress] error:', e);
      socket.emit('terminal:progress-data', {
        stage: 0,
        score: 0,
        completed: false,
        flags: [],
        totalStages: 0
      });
    }
  });

  // ✅ 새로운 이벤트: 현재 스테이지 프롬프트 가져오기
  socket.on('terminal:get-prompt', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    console.log('🔍 [terminal:get-prompt] Request received:', { arenaId, userId });
    
    if (!arenaId || !userId) {
      console.warn('⚠️ [terminal:get-prompt] Missing arenaId or userId');
      return;
    }

    try {
      // Arena에서 시나리오 정보 가져오기
      console.log('📡 [terminal:get-prompt] Fetching arena and scenario...');
      const arena = await Arena.findById(arenaId)
        .select('scenarioId')
        .populate('scenarioId');
      
      if (!arena || !arena.scenarioId) {
        console.error('❌ [terminal:get-prompt] Arena or scenario not found');
        socket.emit('terminal:prompt-data', { prompt: 'Scenario not found.' });
        return;
      }

      console.log('✅ [terminal:get-prompt] Arena found:', arena._id);

      // 유저의 현재 스테이지
      const progressDoc = await ArenaProgress.findOne({ arena: arenaId, user: userId });
      const currentStage = (progressDoc?.stage || 0) + 1;
      console.log('📊 [terminal:get-prompt] Current stage:', currentStage);

      const scenario = arena.scenarioId as any;
      const stageData = scenario.data?.stages?.find((s: any) => s.stage === currentStage);
      
      if (!stageData) {
        console.warn('⚠️ [terminal:get-prompt] No stage data found for stage', currentStage);
        socket.emit('terminal:prompt-data', { 
          prompt: 'All stages completed!',
          stage: currentStage,
          totalStages: scenario.data?.totalStages || scenario.data?.stages?.length || 0
        });
        return;
      }

      // ✅ stage의 prompt 사용
      console.log('✅ [terminal:get-prompt] Using stage prompt');
      socket.emit('terminal:prompt-data', { 
        prompt: stageData.prompt || 'No prompt available',
        stage: currentStage,
        totalStages: scenario.data?.totalStages || scenario.data?.stages?.length
      });
      console.log('📤 [terminal:get-prompt] Sent stage prompt to client');

    } catch (e) {
      console.error('[terminal:get-prompt] error:', e);
      socket.emit('terminal:prompt-data', { prompt: 'Error loading prompt.' });
    }
  });
};