import { Server, Socket } from 'socket.io';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import { terminalProcessCommand } from '../../services/terminalRace/terminalEngine';
import { endArenaImmediately } from '../utils/endArenaProcedure';

// 유예 시간 타이머 저장
const graceTimers = new Map<string, NodeJS.Timeout>();

// ✅ 중복 처리 방지를 위한 Map
const processingCommands = new Map<string, boolean>();

export const registerTerminalRaceHandlers = (io: Server, socket: Socket) => {
  
  socket.on('terminal:execute', async ({ arenaId, command }: { arenaId?: string; command: string }) => {
    const effectiveArenaId = arenaId || (socket as any).arenaId;
    const userId = (socket as any).userId;

    // ✅ 중복 처리 방지 키
    const commandKey = `${effectiveArenaId}-${userId}-${command}-${Date.now()}`;
    const userKey = `${effectiveArenaId}-${userId}`;
    
    console.log(`\n🎮 [terminal:execute] START ===`);
    console.log(`   Arena: ${effectiveArenaId}, User: ${userId}`);
    console.log(`   Command: "${command}"`);
    console.log(`   Processing: ${processingCommands.has(userKey)}`);

    if (!effectiveArenaId || !userId) {
      socket.emit('terminal:error', { message: 'Invalid request: missing arenaId or userId' });
      return;
    }

    // ✅ 이미 처리 중이면 무시
    if (processingCommands.has(userKey)) {
      console.log('⏭️ [terminal:execute] Already processing a command for this user');
      return;
    }

    // 처리 시작 표시
    processingCommands.set(userKey, true);

    try {
      // 1. Arena 상태 확인
      const arena = await Arena.findById(effectiveArenaId).populate('scenarioId');
      if (!arena) {
        socket.emit('terminal:error', { message: 'Arena not found' });
        return;
      }
      if (arena.status !== 'started') {
        socket.emit('terminal:error', { message: 'Arena has not started yet' });
        return;
      }

      // 2. 현재 진행 상황 확인
      const currentProgress = await ArenaProgress.findOne({ arena: effectiveArenaId, user: userId });
      
      if (currentProgress?.completed) {
        console.log('⏭️ [terminal:execute] User already completed');
        socket.emit('terminal:result', {
          userId: String(userId),
          command,
          message: 'You have already completed all stages!',
          scoreGain: 0,
          stageAdvanced: false,
          currentStage: currentProgress.stage,
          totalScore: currentProgress.score,
          completed: true
        });
        return;
      }

      // 3. 명령어 처리
      const result = await terminalProcessCommand(effectiveArenaId, String(userId), command);
      console.log('📤 Engine Result:', result);

      // 4. 기본 응답 (명령어 불일치)
      if (!result.progressDelta && !result.advanceStage && !result.flagFound) {
        console.log('⚠️ [terminal:execute] Default response');
        
        socket.emit('terminal:result', {
          userId: String(userId),
          command,
          message: result.message,
          scoreGain: 0,
          stageAdvanced: false,
          currentStage: currentProgress?.stage || 0,
          totalScore: currentProgress?.score || 0,
          completed: false
        });
        
        console.log('✅ [terminal:execute] END (default) ===\n');
        return;
      }

      // 5. 진행 상황 업데이트 (명령어 성공)
      const updatePayload: any = {};
      
      if (result.progressDelta && result.progressDelta > 0) {
        updatePayload.$inc = { score: result.progressDelta };
      }
      
      if (result.advanceStage) {
        const currentStage = currentProgress?.stage || 0;
        const newStage = currentStage + 1;
        
        console.log(`🎯 Stage advancement: ${currentStage} → ${newStage}`);
        updatePayload.$set = { stage: newStage };
        
        const scenario = arena.scenarioId as any;
        const totalStages = scenario?.data?.totalStages || 0;
        
        if (newStage >= totalStages) {
          console.log('🏆 All stages completed!');
          updatePayload.$set.completed = true;
        }
      }
      
      if (result.flagFound) {
        if (!updatePayload.$set) updatePayload.$set = {};
        updatePayload.$set.completed = true;
      }

      console.log('📝 Update Payload:', JSON.stringify(updatePayload, null, 2));

      // 6. DB 업데이트
      const progressDoc = await ArenaProgress.findOneAndUpdate(
        { arena: effectiveArenaId, user: userId },
        updatePayload,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      
      console.log('✅ Progress Updated:', {
        userId,
        stage: progressDoc.stage,
        score: progressDoc.score,
        completed: progressDoc.completed
      });
      
      // 7. ✅ 해당 유저에게만 결과 전송 (딱 한 번!)
      console.log('📤 [terminal:execute] Emitting result to user');
      socket.emit('terminal:result', {
        userId: String(userId),
        command,
        message: result.message,
        scoreGain: result.progressDelta || 0,
        stageAdvanced: result.advanceStage || false,
        currentStage: progressDoc.stage,
        totalScore: progressDoc.score,
        completed: progressDoc.completed
      });

      // 8. 다른 참가자들에게 진행 상황 브로드캐스트 (스테이지 진행/완료 시에만)
      if (result.advanceStage || progressDoc.completed) {
        console.log('📤 [terminal:execute] Broadcasting participant update');
        
        // ✅ socket.broadcast로 자기 자신 제외하고 전송
        socket.to(effectiveArenaId).emit('participant:update', {
          userId: String(userId),
          progress: {
            score: progressDoc.score,
            stage: progressDoc.stage,
            completed: progressDoc.completed
          }
        });
      }
      
      console.log('✅ [terminal:execute] END (success) ===\n');
      
      // 9. 게임 종료 처리
      if (progressDoc.completed && !arena.winner) {
        console.log(`🏆 First winner: ${userId}`);
        
        const submittedAt = new Date();
        await ArenaProgress.updateOne({ _id: progressDoc._id }, { $set: { submittedAt } });
        
        arena.winner = userId;
        arena.firstSolvedAt = submittedAt;
        await arena.save();
        
        const graceMs = arena.settings?.graceMs ?? 90000;
        const graceSec = Math.floor(graceMs / 1000);
        
        console.log(`⏳ [TerminalRace] Grace period: ${graceSec}s`);
        
        io.to(effectiveArenaId).emit('arena:grace-period-started', {
          graceMs,
          graceSec,
          message: `First player completed! You have ${graceSec} seconds to finish.`
        });
        
        const timer = setTimeout(async () => {
          console.log('⏰ [TerminalRace] Grace period ended');
          graceTimers.delete(effectiveArenaId);
          await endArenaImmediately(effectiveArenaId, io);
        }, graceMs);
        
        graceTimers.set(effectiveArenaId, timer);
        
      } else if (progressDoc.completed && arena.winner) {
        console.log(`✅ Player ${userId} completed during grace period`);
        
        const submittedAt = new Date();
        await ArenaProgress.updateOne({ _id: progressDoc._id }, { $set: { submittedAt } });
        
        const allProgress = await ArenaProgress.find({ arena: effectiveArenaId });
        const activeParticipants = arena.participants.filter((p: any) => !p.hasLeft);
        const completedCount = allProgress.filter(p => p.completed).length;
        
        console.log(`📊 Progress: ${completedCount}/${activeParticipants.length}`);
        
        if (completedCount >= activeParticipants.length) {
          console.log('🎉 All completed! Ending immediately');
          
          if (graceTimers.has(effectiveArenaId)) {
            clearTimeout(graceTimers.get(effectiveArenaId)!);
            graceTimers.delete(effectiveArenaId);
            console.log('⏹️ Grace timer cancelled');
          }
          
          await endArenaImmediately(effectiveArenaId, io);
        }
      }

    } catch (e) {
      console.error('[terminal:execute] error:', e);
      socket.emit('arena:action-failed', { 
        reason: (e as Error).message || 'An error occurred' 
      });
    } finally {
      // ✅ 처리 완료 후 플래그 제거
      setTimeout(() => {
        processingCommands.delete(userKey);
        console.log('🔓 [terminal:execute] Released lock for user');
      }, 500);
    }
  });

  // 진행 상황 조회
  socket.on('terminal:get-progress', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    console.log('📡 [terminal:get-progress]', { arenaId, userId });
    
    if (!arenaId || !userId) return;

    try {
      const arena = await Arena.findById(arenaId).select('scenarioId').populate('scenarioId');
      const scenario = arena?.scenarioId as any;
      const totalStages = scenario?.data?.totalStages || scenario?.data?.stages?.length || 0;
      
      const progressDoc = await ArenaProgress.findOne({ arena: arenaId, user: userId }).lean();
      
      console.log('📊 Progress:', {
        stage: progressDoc?.stage || 0,
        score: progressDoc?.score || 0,
        completed: progressDoc?.completed || false
      });

      socket.emit('terminal:progress-data', {
        stage: progressDoc?.stage || 0,
        score: progressDoc?.score || 0,
        completed: progressDoc?.completed || false,
        totalStages: totalStages
      });
    } catch (e) {
      console.error('[terminal:get-progress] error:', e);
      socket.emit('terminal:progress-data', {
        stage: 0,
        score: 0,
        completed: false,
        totalStages: 0
      });
    }
  });

  // 프롬프트 조회
  socket.on('terminal:get-prompt', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    console.log('🔍 [terminal:get-prompt]', { arenaId, userId });
    
    if (!arenaId || !userId) return;

    try {
      const arena = await Arena.findById(arenaId).select('scenarioId').populate('scenarioId');
      
      if (!arena || !arena.scenarioId) {
        socket.emit('terminal:prompt-data', { prompt: 'Scenario not found.' });
        return;
      }

      const progressDoc = await ArenaProgress.findOne({ arena: arenaId, user: userId });
      const currentStage = (progressDoc?.stage || 0) + 1;
      
      console.log('🎯 Current stage:', currentStage);

      const scenario = arena.scenarioId as any;
      const stageData = scenario.data?.stages?.find((s: any) => s.stage === currentStage);
      
      if (!stageData) {
        socket.emit('terminal:prompt-data', { 
          prompt: 'All stages completed!',
          stage: currentStage,
          totalStages: scenario.data?.totalStages || 0
        });
        return;
      }

      console.log('📤 Sending prompt for stage:', currentStage);

      socket.emit('terminal:prompt-data', { 
        prompt: stageData.prompt || 'No prompt available',
        stage: currentStage,
        totalStages: scenario.data?.totalStages || scenario.data?.stages?.length
      });
    } catch (e) {
      console.error('[terminal:get-prompt] error:', e);
      socket.emit('terminal:prompt-data', { prompt: 'Error loading prompt.' });
    }
  });

  // 타이머 종료
  socket.on('arena:end', async ({ arenaId }: { arenaId: string }) => {
    console.log(`⏰ [arena:end] Time's up: ${arenaId}`);
    
    try {
      const arena = await Arena.findById(arenaId);
      if (!arena || arena.status === 'ended') return;
      
      if (graceTimers.has(arenaId)) {
        clearTimeout(graceTimers.get(arenaId)!);
        graceTimers.delete(arenaId);
        console.log('⏹️ Grace timer cancelled');
      }
      
      console.log('🏁 Forcing end');
      await endArenaImmediately(arenaId, io);
    } catch (e) {
      console.error('[arena:end] error:', e);
    }
  });
};

// ✅ Terminal Race 초기화 함수
export const initializeTerminalRace = async (arenaId: string) => {
  try {
    console.log(`🎯 [initializeTerminalRace] Initializing arena ${arenaId}`);

    const arena = await Arena.findById(arenaId).populate('participants.user');
    if (!arena) {
      console.error(`❌ [initializeTerminalRace] Arena ${arenaId} not found`);
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
          mode: 'terminal-race',
          completed: false,
          score: 0,
          stage: 0
        });

        console.log(`✅ Created ArenaProgress for user ${userId}`);
      } else {
        console.log(`⏭️ ArenaProgress already exists for user ${userId}`);
      }
    }

    console.log(`✅ [initializeTerminalRace] Initialized ${arena.participants.length} participants`);
  } catch (error) {
    console.error(`❌ [initializeTerminalRace] Error:`, error);
    throw error;
  }
};