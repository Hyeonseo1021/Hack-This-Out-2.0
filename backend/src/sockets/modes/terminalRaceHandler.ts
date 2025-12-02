import { Server, Socket } from 'socket.io';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import { terminalProcessCommand } from '../../services/terminalRace/terminalEngine';
import { endArenaImmediately, endArenaProcedure, getGraceInfo, isGracePeriodActive } from '../utils/endArenaProcedure';

// ✅ 중복 처리 방지를 위한 Map
const processingCommands = new Map<string, boolean>();

/**
 * ⏱️ 시간 보너스 계산
 * - 빠른 완료 시 추가 점수 부여
 * - 기준: timeLimit의 50% 이내 완료 시 최대 보너스
 */
function calculateTimeBonus(
  startTime: Date,
  completedAt: Date,
  timeLimit: number // 초 단위
): number {
  const elapsedSec = Math.floor((completedAt.getTime() - startTime.getTime()) / 1000);
  const halfTimeLimit = timeLimit / 2;

  // 시간 제한의 50% 이내 완료 시 최대 보너스 (50점)
  // 50% ~ 100% 사이는 선형 감소
  // 100% 초과 시 보너스 없음

  const MAX_TIME_BONUS = 50;

  if (elapsedSec <= halfTimeLimit) {
    // 50% 이내 완료: 최대 보너스
    return MAX_TIME_BONUS;
  } else if (elapsedSec <= timeLimit) {
    // 50% ~ 100%: 선형 감소
    const remainingRatio = (timeLimit - elapsedSec) / halfTimeLimit;
    return Math.floor(MAX_TIME_BONUS * remainingRatio);
  }

  return 0; // 시간 초과
}

// ✅ Helper: 활성 버프 가져오기
const getActiveBuffs = (arena: any, userId: string) => {
  const participant = arena.participants.find(
    (p: any) => String((p.user as any)?._id ?? p.user) === userId
  );

  if (!participant || !participant.activeBuffs) return [];

  const now = new Date();
  return participant.activeBuffs.filter((buff: any) => {
    return buff.expiresAt && new Date(buff.expiresAt) > now;
  });
};

// ✅ Helper: 점수 부스트 적용
const applyScoreBoost = (baseScore: number, buffs: any[]) => {
  const scoreBoostBuff = buffs.find((b: any) => b.type === 'score_boost');
  if (!scoreBoostBuff || !scoreBoostBuff.value) return baseScore;

  const multiplier = 1 + (scoreBoostBuff.value / 100);
  return Math.floor(baseScore * multiplier);
};

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
      console.log('📤 Message type:', typeof result.message);
      console.log('📤 Message value:', JSON.stringify(result.message));

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
      let boostedScore = 0;
      let stageActuallyAdvanced = false;

      // ✅ 스테이지 진행 여부 먼저 확인 (중복 점수 방지)
      if (result.advanceStage) {
        const currentStage = currentProgress?.stage || 0;
        const scenario = arena.scenarioId as any;
        const totalStages = scenario?.data?.totalStages || 0;

        // ✅ 현재 스테이지가 이미 완료된 경우 점수 부여하지 않음
        const expectedStage = currentStage + 1;

        // 엔진에서 계산한 스테이지와 실제 DB 스테이지가 일치하는지 확인
        if (currentStage < totalStages) {
          const newStage = currentStage + 1;
          console.log(`🎯 Stage advancement: ${currentStage} → ${newStage}`);
          updatePayload.$set = { stage: newStage };
          stageActuallyAdvanced = true;

          if (newStage >= totalStages) {
            console.log('🏆 All stages completed!');
            updatePayload.$set.completed = true;
          }
        } else {
          console.log(`⚠️ [DUPLICATE PREVENTION] Stage already at max (${currentStage}/${totalStages}), ignoring advancement`);
        }
      }

      // ✅ 점수 부여: progressDelta > 0이면 점수 부여 (스테이지 진행 여부와 무관)
      if (result.progressDelta && result.progressDelta > 0) {
        // ✅ 점수 부스트 적용
        const activeBuffs = getActiveBuffs(arena, String(userId));
        boostedScore = applyScoreBoost(result.progressDelta, activeBuffs);
        if (!updatePayload.$inc) updatePayload.$inc = {};
        updatePayload.$inc.score = boostedScore;

        // 부스트가 적용되었는지 로그
        if (boostedScore !== result.progressDelta) {
          console.log(`🚀 Score boost applied: ${result.progressDelta} → ${boostedScore}`);
        }
      }

      if (result.flagFound) {
        if (!updatePayload.$set) updatePayload.$set = {};
        updatePayload.$set.completed = true;
      }

      // ✅ 업데이트할 내용이 없으면 (중복 시도) 현재 상태만 반환
      if (!updatePayload.$set && !updatePayload.$inc) {
        console.log('⚠️ [DUPLICATE PREVENTION] No updates to apply, returning current state');
        socket.emit('terminal:result', {
          userId: String(userId),
          command,
          message: result.message,
          scoreGain: 0, // 중복이므로 점수 0
          baseScore: 0,
          stageAdvanced: false,
          currentStage: currentProgress?.stage || 0,
          totalScore: currentProgress?.score || 0,
          completed: currentProgress?.completed || false
        });
        return;
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
        scoreGain: boostedScore || result.progressDelta || 0, // ✅ progressDelta가 있으면 점수 부여
        baseScore: result.progressDelta || 0,
        stageAdvanced: stageActuallyAdvanced,
        currentStage: progressDoc.stage,
        totalScore: progressDoc.score,
        completed: progressDoc.completed
      });

      // 8. 다른 참가자들에게 진행 상황 브로드캐스트 (점수 변경/스테이지 진행/완료 시)
      if (boostedScore > 0 || stageActuallyAdvanced || progressDoc.completed) {
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
        const startTime = arena.startTime ? new Date(arena.startTime) : submittedAt;
        const timeLimit = arena.timeLimit || 600; // 기본 10분

        // ✅ 시간 보너스 계산 및 적용
        const timeBonus = calculateTimeBonus(startTime, submittedAt, timeLimit);
        console.log(`⏱️ [TerminalRace] Time bonus for first completer: +${timeBonus} points`);

        await ArenaProgress.updateOne(
          { _id: progressDoc._id },
          {
            $set: { submittedAt },
            $inc: {
              score: timeBonus,
              'terminalRace.timeBonusPoints': timeBonus
            }
          }
        );

        arena.winner = userId;
        arena.firstSolvedAt = submittedAt;
        await arena.save();

        // ✅ 시간 보너스가 적용된 점수로 업데이트 브로드캐스트
        const updatedScore = progressDoc.score + timeBonus;
        socket.emit('terminal:result', {
          userId: String(userId),
          command: 'TIME_BONUS',
          message: { ko: `시간 보너스 +${timeBonus}점!`, en: `Time bonus +${timeBonus} points!` },
          scoreGain: timeBonus,
          stageAdvanced: false,
          currentStage: progressDoc.stage,
          totalScore: updatedScore,
          completed: true
        });

        // 다른 참가자들에게도 알림
        socket.to(effectiveArenaId).emit('participant:update', {
          userId: String(userId),
          progress: {
            score: updatedScore,
            stage: progressDoc.stage,
            completed: true
          }
        });

        console.log(`⏳ [TerminalRace] Calling endArenaProcedure for dynamic grace period`);

        // ✅ endArenaProcedure를 호출하여 동적 유예시간 계산 (내부에서 타이머 관리)
        await endArenaProcedure(effectiveArenaId, io);

      } else if (progressDoc.completed && arena.winner && isGracePeriodActive(effectiveArenaId)) {
        console.log(`✅ Player ${userId} completed during grace period`);

        const submittedAt = new Date();
        const startTime = arena.startTime ? new Date(arena.startTime) : submittedAt;
        const timeLimit = arena.timeLimit || 600;

        // ✅ Grace period 중 완주자에게도 시간 보너스 적용
        const timeBonus = calculateTimeBonus(startTime, submittedAt, timeLimit);
        console.log(`⏱️ [TerminalRace] Time bonus for player ${userId}: +${timeBonus} points`);

        await ArenaProgress.updateOne(
          { _id: progressDoc._id },
          {
            $set: { submittedAt },
            $inc: {
              score: timeBonus,
              'terminalRace.timeBonusPoints': timeBonus
            }
          }
        );

        // ✅ 시간 보너스가 적용된 점수로 업데이트 브로드캐스트
        const updatedScore = progressDoc.score + timeBonus;
        socket.emit('terminal:result', {
          userId: String(userId),
          command: 'TIME_BONUS',
          message: { ko: `시간 보너스 +${timeBonus}점!`, en: `Time bonus +${timeBonus} points!` },
          scoreGain: timeBonus,
          stageAdvanced: false,
          currentStage: progressDoc.stage,
          totalScore: updatedScore,
          completed: true
        });

        socket.to(effectiveArenaId).emit('participant:update', {
          userId: String(userId),
          progress: {
            score: updatedScore,
            stage: progressDoc.stage,
            completed: true
          }
        });
        
        const allProgress = await ArenaProgress.find({ arena: effectiveArenaId });
        const activeParticipants = arena.participants.filter((p: any) => !p.hasLeft);
        const completedCount = allProgress.filter(p => p.completed).length;
        
        console.log(`📊 Progress: ${completedCount}/${activeParticipants.length}`);
        
        if (completedCount >= activeParticipants.length) {
          console.log('🎉 All completed! Ending immediately');
          // endArenaImmediately 내부에서 graceTimer를 정리함
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

      // ✅ 유예시간 정보 조회
      const graceInfoData = getGraceInfo(arenaId);

      console.log('📊 Progress:', {
        stage: progressDoc?.stage || 0,
        score: progressDoc?.score || 0,
        completed: progressDoc?.completed || false,
        graceInfo: graceInfoData
      });

      socket.emit('terminal:progress-data', {
        stage: progressDoc?.stage || 0,
        score: progressDoc?.score || 0,
        completed: progressDoc?.completed || false,
        totalStages: totalStages,
        // ✅ 유예시간 정보 추가
        graceTimeRemaining: graceInfoData?.remainingSec || null,
        totalGraceTime: graceInfoData?.totalSec || null
      });
    } catch (e) {
      console.error('[terminal:get-progress] error:', e);
      socket.emit('terminal:progress-data', {
        stage: 0,
        score: 0,
        completed: false,
        totalStages: 0,
        graceTimeRemaining: null,
        totalGraceTime: null
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
      
      console.log('🏁 Forcing end');
      // endArenaImmediately 내부에서 graceTimer를 정리함
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