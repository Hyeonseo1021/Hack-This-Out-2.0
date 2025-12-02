// handlers/utils/endArenaProcedure.ts

import { Server } from 'socket.io';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import { GameMode, assignBatchArenaExp } from './expCalculator';
import { GameMode as CoinGameMode, assignBatchArenaCoin, isFirstScenarioCompletion } from './coinCalculator';

// 진행 중인 유예 타이머 추적
const graceTimers = new Map<string, NodeJS.Timeout>();

// 유예시간 정보 저장 (arenaId -> { startedAt, totalSec })
const graceInfo = new Map<string, { startedAt: number; totalSec: number }>();

/**
 * ✅ 유예시간 진행 중인지 확인
 */
export function isGracePeriodActive(arenaId: string): boolean {
  return graceTimers.has(arenaId);
}

/**
 * ✅ 유예시간 정보 조회 (새로고침 시 복원용)
 */
export function getGraceInfo(arenaId: string): { remainingSec: number; totalSec: number } | null {
  const info = graceInfo.get(arenaId);
  if (!info) return null;

  const elapsed = Math.floor((Date.now() - info.startedAt) / 1000);
  const remainingSec = Math.max(0, info.totalSec - elapsed);

  if (remainingSec <= 0) {
    graceInfo.delete(arenaId);
    return null;
  }

  return { remainingSec, totalSec: info.totalSec };
}

/**
 * ✅ 모든 참가자가 완료했는지 확인
 * - progress.completed 체크 + VulnerabilityScannerRace의 경우 vulnerabilitiesFound 체크
 */
async function checkAllParticipantsCompleted(arenaId: string): Promise<boolean> {
  const arena = await Arena.findById(arenaId).populate('scenarioId');
  if (!arena) return false;

  const progressDocs = await ArenaProgress.find({ arena: arenaId });

  if (progressDocs.length === 0) return false;

  // VulnerabilityScannerRace 모드인 경우 특별 처리
  if (arena.mode === 'VULNERABILITY_SCANNER_RACE') {
    const scenario = arena.scenarioId as any;
    const totalVulns = scenario?.data?.vulnerabilities?.length || 0;

    if (totalVulns === 0) return false;

    const allCompleted = progressDocs.every((p: any) => {
      const found = p.vulnerabilityScannerRace?.vulnerabilitiesFound || 0;
      return found >= totalVulns;
    });

    console.log(`📊 [checkAllParticipantsCompleted] VulnerabilityScannerRace: ${progressDocs.length} participants, total vulns: ${totalVulns}, all completed: ${allCompleted}`);
    return allCompleted;
  }

  // 다른 모드는 progress.completed 체크
  const allCompleted = progressDocs.every(p => p.completed === true);

  console.log(`📊 [checkAllParticipantsCompleted] ${progressDocs.length} participants, all completed: ${allCompleted}`);

  return allCompleted;
}

/**
 * ✅ Arena 즉시 종료 (유예 시간 없이)
 * @param sendAllCompletedNotification - 모든 플레이어 완료 알림을 보낼지 여부 (기본: true)
 */
export async function endArenaImmediately(arenaId: string, io: Server, sendAllCompletedNotification: boolean = true) {
  console.log(`\n🏁 [endArenaImmediately] Ending arena: ${arenaId}`);

  // 기존 유예 타이머 취소
  if (graceTimers.has(arenaId)) {
    clearTimeout(graceTimers.get(arenaId)!);
    graceTimers.delete(arenaId);
    graceInfo.delete(arenaId);
    console.log('⏹️ Cancelled existing grace timer');
  }

  // ✅ 모든 플레이어에게 완료 알림 전송
  if (sendAllCompletedNotification) {
    io.to(arenaId).emit('arena:all-completed', {
      message: {
        ko: '모든 플레이어가 완료했습니다! 결과 페이지로 이동합니다...',
        en: 'All players completed! Redirecting to results...'
      }
    });
    console.log('📢 [endArenaImmediately] Sent arena:all-completed notification');
  }

  await finalizeArena(arenaId, io);
}

/**
 * ✅ Arena 종료 프로시저 (유예 시간 적용)
 * 유예 시간 = 남은 시간의 1/2 (최소 30초, 최대 5분)
 */
export async function endArenaProcedure(arenaId: string, io: Server) {
  console.log(`\n🏁 [endArenaProcedure] Starting for arena: ${arenaId}`);

  try {
    const arena = await Arena.findById(arenaId);
    if (!arena) {
      console.error('❌ [endArenaProcedure] Arena not found');
      return;
    }

    // 이미 종료된 경우
    if (arena.status === 'ended') {
      console.log('⚠️ [endArenaProcedure] Arena already ended');
      return;
    }

    // 이미 유예 타이머가 실행 중인 경우
    if (graceTimers.has(arenaId)) {
      console.log('⏳ [endArenaProcedure] Grace period already running, skipping...');
      return;
    }

    // 설정 확인
    const endOnFirstSolve = arena.settings?.endOnFirstSolve ?? true;

    console.log(`⚙️ Settings: endOnFirstSolve=${endOnFirstSolve}`);

    // endOnFirstSolve가 false인 경우에도 특정 조건에서는 종료 처리
    if (!endOnFirstSolve) {
      // ✅ 활성 참가자 수 확인
      const activeParticipants = arena.participants.filter((p: any) => !p.hasLeft);
      const activeCount = activeParticipants.length;

      // ✅ 모든 참가자의 완료 여부 확인
      const allCompleted = await checkAllParticipantsCompleted(arenaId);

      console.log(`📊 Active participants: ${activeCount}, All completed: ${allCompleted}`);

      // 혼자 플레이 중이거나 모든 참가자가 완료한 경우 즉시 종료
      if (activeCount === 1 || allCompleted) {
        console.log('🏁 Solo play or all completed, ending immediately');
        await endArenaImmediately(arenaId, io);
        return;
      }

      console.log('⏸️ endOnFirstSolve is false, waiting for time limit or all complete');
      return;
    }

    // ✅ 동적 유예 시간 계산: 남은 시간의 1/2
    const now = new Date();
    const startTime = arena.startTime ? new Date(arena.startTime) : now;
    const timeLimitMs = (arena.timeLimit || 600) * 1000; // 기본 10분
    const elapsedMs = now.getTime() - startTime.getTime();
    const remainingMs = Math.max(0, timeLimitMs - elapsedMs);

    // 남은 시간의 1/2, 최소 30초, 최대 5분, 그리고 남은 시간을 초과할 수 없음
    const calculatedGraceMs = Math.floor(remainingMs / 2);
    const MIN_GRACE_MS = 30000;  // 30초
    const MAX_GRACE_MS = 300000; // 5분
    const graceMs = Math.min(remainingMs, Math.max(MIN_GRACE_MS, Math.min(MAX_GRACE_MS, calculatedGraceMs)));

    console.log(`⏱️ Time calculation:
      - Time limit: ${arena.timeLimit}s
      - Elapsed: ${Math.floor(elapsedMs / 1000)}s
      - Remaining: ${Math.floor(remainingMs / 1000)}s
      - Grace period: ${Math.floor(graceMs / 1000)}s (${Math.floor(remainingMs / 2000)}s calculated, clamped to ${Math.floor(MIN_GRACE_MS / 1000)}-${Math.floor(MAX_GRACE_MS / 1000)}s)`);

    // graceMs가 0이면 즉시 종료
    if (graceMs === 0 || remainingMs === 0) {
      console.log('⚡ No time remaining, ending immediately');
      await endArenaImmediately(arenaId, io);
      return;
    }

    // ✅ 유예 시간 시작
    console.log(`⏳ Starting grace period: ${graceMs}ms (${Math.floor(graceMs / 1000)}s)`);

    // 모든 참가자에게 유예 시간 알림
    const graceSec = Math.floor(graceMs / 1000);
    const graceMin = Math.floor(graceSec / 60);
    const graceSecRemainder = graceSec % 60;
    const graceTimeFormatted = graceMin > 0
      ? `${graceMin}:${String(graceSecRemainder).padStart(2, '0')}`
      : `${graceSec}s`;

    // ✅ 유예시간 정보 저장 (새로고침 복원용)
    graceInfo.set(arenaId, { startedAt: Date.now(), totalSec: graceSec });

    io.to(arenaId).emit('arena:grace-period-started', {
      graceMs,
      graceSec,
      totalGraceSec: graceSec,
      message: `First player completed! You have ${graceTimeFormatted} to finish.`
    });

    // 유예 타이머 설정
    const timer = setTimeout(async () => {
      console.log(`⏰ [Grace Timer] Grace period ended for arena: ${arenaId}`);
      graceTimers.delete(arenaId);
      graceInfo.delete(arenaId); // ✅ 유예시간 정보도 삭제
      await finalizeArena(arenaId, io);
    }, graceMs);

    graceTimers.set(arenaId, timer);

  } catch (error) {
    console.error('❌ [endArenaProcedure] Error:', error);
    throw error;
  }
}

/**
 * ✅ 유예 시간 중 참가자 완료 체크 (게임 핸들러에서 호출)
 * - 모든 참가자가 완료하면 즉시 종료
 */
export async function checkAndEndIfAllCompleted(arenaId: string, io: Server) {
  console.log(`🔍 [checkAndEndIfAllCompleted] Checking arena: ${arenaId}`);
  
  try {
    const arena = await Arena.findById(arenaId);
    if (!arena || arena.status === 'ended') {
      console.log('⚠️ Arena not found or already ended');
      return;
    }

    // 유예 시간 중이 아니면 체크하지 않음
    if (!graceTimers.has(arenaId)) {
      console.log('⚠️ No grace timer running, skipping check');
      return;
    }

    // ✅ 모든 참가자가 완료했는지 확인
    const allCompleted = await checkAllParticipantsCompleted(arenaId);

    if (allCompleted) {
      console.log('🎉 All participants completed! Ending arena immediately.');

      // 유예 타이머 취소
      clearTimeout(graceTimers.get(arenaId)!);
      graceTimers.delete(arenaId);
      graceInfo.delete(arenaId);

      // ✅ endArenaImmediately를 호출하면서 알림도 함께 전송
      await endArenaImmediately(arenaId, io, true);
    } else {
      console.log('⏳ Not all participants completed yet, waiting...');
    }
  } catch (error) {
    console.error('❌ [checkAndEndIfAllCompleted] Error:', error);
  }
}

/**
 * Arena mode를 GameMode enum으로 변환
 */
function convertArenaModeToGameMode(arenaMode: string): GameMode {
  const modeMap: Record<string, GameMode> = {
    'TERMINAL_HACKING_RACE': GameMode.TERMINAL_RACE,
    'SOCIAL_ENGINEERING_CHALLENGE': GameMode.SOCIAL_ENGINEERING,
    'VULNERABILITY_SCANNER_RACE': GameMode.VULNERABILITY_SCANNER,
    'FORENSICS_RUSH': GameMode.FORENSICS_RUSH
  };

  return modeMap[arenaMode] || GameMode.TERMINAL_RACE;
}

// handlers/utils/endArenaProcedure.ts의 finalizeArena 함수 수정

async function finalizeArena(arenaId: string, io: Server) {
  console.log(`\n🎬 [finalizeArena] Finalizing arena: ${arenaId}`);

  try {
    const arena = await Arena.findById(arenaId);
    if (!arena) {
      console.error('❌ [finalizeArena] Arena not found');
      return;
    }

    // 이미 종료된 경우
    if (arena.status === 'ended') {
      console.log('⚠️ [finalizeArena] Arena already ended');
      return;
    }

    // 시작 시간 확인
    if (!arena.startTime) {
      console.error('❌ [finalizeArena] Arena has no start time');
      arena.status = 'ended';
      arena.endTime = new Date();
      await arena.save();
      return;
    }

    const startTime = new Date(arena.startTime);
    const endTime = new Date();

    // 시나리오 조회 (VulnerabilityScannerRace 체크용)
    const arenaWithScenario = await Arena.findById(arenaId).populate('scenarioId');
    const scenario = arenaWithScenario?.scenarioId as any;

    // 모든 참가자의 진행 상황 조회
    const progressDocs = await ArenaProgress.find({ arena: arenaId });
    console.log(`👥 [finalizeArena] Found ${progressDocs.length} participants`);

    // ✅ VulnerabilityScannerRace 모드인 경우 completed 상태 먼저 업데이트
    if (arena.mode === 'VULNERABILITY_SCANNER_RACE') {
      const totalVulns = scenario?.data?.vulnerabilities?.length || 0;
      console.log(`🔍 [finalizeArena] VulnerabilityScannerRace mode, total vulns: ${totalVulns}`);

      for (const progress of progressDocs) {
        const found = (progress as any).vulnerabilityScannerRace?.vulnerabilitiesFound || 0;
        const isCompleted = found >= totalVulns;

        if (isCompleted && !progress.completed) {
          console.log(`   ✅ Marking user ${progress.user} as completed (${found}/${totalVulns} vulns)`);
          await ArenaProgress.updateOne(
            { _id: progress._id },
            {
              $set: {
                completed: true,
                submittedAt: progress.submittedAt || endTime
              }
            }
          );
          progress.completed = true;
          progress.submittedAt = progress.submittedAt || endTime;
        }
      }
    }

    // ✅ 각 참가자의 completionTime 계산 및 업데이트
    for (const progress of progressDocs) {
      // ✅ 이미 completionTime이 설정되어 있으면 건너뛰기 (중복 계산 방지)
      if (progress.completionTime !== null && progress.completionTime !== undefined) {
        console.log(`   ⏭️ Skip user ${progress.user}: already has completionTime ${progress.completionTime}s`);
        continue;
      }

      let completionTime: number | null = null;

      if (progress.completed && progress.submittedAt) {
        // ✅ 완료한 경우: 제출 시간 - 시작 시간
        completionTime = Math.floor(
          (new Date(progress.submittedAt).getTime() - startTime.getTime()) / 1000
        );

        console.log(`📊 Calculating completionTime for ${progress.user}:`, {
          submittedAt: new Date(progress.submittedAt).toISOString(),
          startTime: startTime.toISOString(),
          completionTime: `${completionTime}s`
        });
      } else if (progress.completed) {
        // ⚠️ 완료했지만 submittedAt이 없는 경우 (이론상 발생하면 안 됨)
        completionTime = Math.floor(
          (endTime.getTime() - startTime.getTime()) / 1000
        );

        console.warn(`⚠️ No submittedAt for ${progress.user}, using endTime:`, {
          endTime: endTime.toISOString(),
          completionTime: `${completionTime}s`
        });
      }

      // ✅ completionTime 업데이트
      if (completionTime !== null) {
        await ArenaProgress.updateOne(
          { _id: progress._id },
          {
            $set: {
              completionTime,
              submittedAt: progress.submittedAt || endTime
            }
          }
        );

        console.log(`   ✅ Updated completionTime for user ${progress.user}: ${completionTime}s`);
      }
    }

    // ✅ 모든 참가자의 최종 상태 로그 출력 (디버깅용)
    const allProgress = await ArenaProgress.find({ arena: arenaId }).lean();
    console.log('\n📊 Final completion times:');
    allProgress
      .sort((a, b) => {
        if (!a.submittedAt) return 1;
        if (!b.submittedAt) return -1;
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      })
      .forEach(p => {
        console.log(`   - User ${p.user}:`, {
          completed: p.completed,
          score: p.score,
          submittedAt: p.submittedAt ? new Date(p.submittedAt).toISOString() : 'N/A',
          completionTime: p.completionTime !== null ? `${p.completionTime}s` : 'N/A'
        });
      });

    // Arena 상태 업데이트
    arena.status = 'ended';
    arena.endTime = endTime;

    // Winner가 아직 설정되지 않았다면 최고 점수자를 승자로
    if (!arena.winner) {
      const topProgress = await ArenaProgress.findOne({ arena: arenaId })
        .sort({ 
          completed: -1,  // 완료한 사람 우선
          score: -1,      // 점수 높은 순
          submittedAt: 1  // 빠른 제출 시간 우선
        })
        .limit(1);
      
      if (topProgress) {
        arena.winner = topProgress.user;
        arena.firstSolvedAt = topProgress.submittedAt || endTime;
        console.log(`👑 [finalizeArena] Winner set to user: ${topProgress.user} at ${arena.firstSolvedAt}`);
      }
    } else {
      console.log(`👑 [finalizeArena] Winner already set: ${arena.winner}`);
    }

    await arena.save();
    console.log(`✅ [finalizeArena] Arena saved with status: ended`);

    // ✨ 경험치 계산 및 부여
    console.log('\n✨ [finalizeArena] Calculating and assigning experience...');
    try {
      // 모든 참가자를 점수 순으로 정렬하여 순위 부여
      const rankedProgress = await ArenaProgress.find({ arena: arenaId })
        .sort({
          completed: -1,  // 완료한 사람 우선
          score: -1,      // 점수 높은 순
          submittedAt: 1  // 빠른 제출 시간 우선
        })
        .lean();

      // 중복 유저 제거 (각 유저당 하나의 progress만 유지)
      const uniqueProgress = rankedProgress.reduce((acc: any[], progress: any) => {
        const userId = progress.user.toString();
        if (!acc.find(p => p.user.toString() === userId)) {
          acc.push(progress);
        }
        return acc;
      }, []);

      console.log(`📊 [finalizeArena] Total progress: ${rankedProgress.length}, Unique users: ${uniqueProgress.length}`);

      // 패배 조건 필터링: 점수가 0 이하인 플레이어는 EXP 부여하지 않음
      const qualifiedProgress = uniqueProgress.filter(progress => {
        const score = progress.score || 0;
        if (score <= 0) {
          console.log(`❌ [finalizeArena] User ${progress.user} excluded from EXP (score: ${score})`);
          return false;
        }
        return true;
      });

      console.log(`🏆 [finalizeArena] Qualified for EXP: ${qualifiedProgress.length}/${uniqueProgress.length} players`);

      // 순위별로 경험치 계산할 데이터 준비 (점수가 있는 플레이어만)
      const expData = qualifiedProgress.map((progress, index) => ({
        userId: progress.user.toString(),
        rank: index + 1,
        score: progress.score || 0,
        completionTime: progress.completionTime || undefined
      }));

      // GameMode 변환
      const gameMode = convertArenaModeToGameMode(arena.mode);

      // 일괄 경험치 부여
      const expResults = await assignBatchArenaExp(expData, gameMode);

      // ArenaProgress에 경험치 정보 저장
      for (const result of expResults) {
        await ArenaProgress.updateOne(
          { arena: arenaId, user: result.userId },
          {
            $set: {
              expEarned: result.expResult.totalExp
            }
          }
        );

        console.log(`   ✅ User ${result.userId}: Rank ${expData.find(d => d.userId === result.userId)?.rank} → +${result.expResult.totalExp} EXP (Level ${result.previousLevel} → ${result.newLevel}${result.leveledUp ? ' 🎉 LEVEL UP!' : ''})`);
      }

      console.log('✨ [finalizeArena] Experience assignment completed\n');
    } catch (error) {
      console.error('❌ [finalizeArena] Error assigning experience:', error);
      // 경험치 부여 실패는 게임 종료를 막지 않음
    }

    // 💰 HTO 코인 계산 및 부여
    console.log('\n💰 [finalizeArena] Calculating and assigning HTO coins...');
    try {
      // 모든 참가자를 점수 순으로 정렬하여 순위 부여
      const rankedProgress = await ArenaProgress.find({ arena: arenaId })
        .sort({
          completed: -1,  // 완료한 사람 우선
          score: -1,      // 점수 높은 순
          submittedAt: 1  // 빠른 제출 시간 우선
        })
        .lean();

      // 중복 유저 제거
      const uniqueProgress = rankedProgress.reduce((acc: any[], progress: any) => {
        const userId = progress.user.toString();
        if (!acc.find(p => p.user.toString() === userId)) {
          acc.push(progress);
        }
        return acc;
      }, []);

      // 점수가 0 이하인 플레이어는 코인 부여하지 않음
      const qualifiedProgress = uniqueProgress.filter(progress => {
        const score = progress.score || 0;
        if (score <= 0) {
          console.log(`❌ [finalizeArena] User ${progress.user} excluded from coins (score: ${score})`);
          return false;
        }
        return true;
      });

      console.log(`🏆 [finalizeArena] Qualified for coins: ${qualifiedProgress.length}/${uniqueProgress.length} players`);

      // 각 플레이어의 첫 클리어 여부 확인 및 코인 데이터 준비
      console.log(`🔍 [finalizeArena] Checking first clear for scenarioId: ${arena.scenarioId}, arenaId: ${arenaId}`);
      const coinData = await Promise.all(
        qualifiedProgress.map(async (progress, index) => {
          const userId = progress.user.toString();
          const isFirstClear = await isFirstScenarioCompletion(userId, arena.scenarioId.toString(), arenaId);
          console.log(`   🔍 User ${userId}: isFirstClear = ${isFirstClear}`);

          return {
            userId,
            rank: index + 1,
            score: progress.score || 0,
            completionTime: progress.completionTime || undefined,
            isFirstClear
          };
        })
      );

      // GameMode 변환 (CoinGameMode로)
      const coinGameMode = arena.mode as CoinGameMode;

      // 일괄 코인 부여
      const coinResults = await assignBatchArenaCoin(coinData, coinGameMode);

      // ArenaProgress에 코인 정보 저장
      for (const result of coinResults) {
        await ArenaProgress.updateOne(
          { arena: arenaId, user: result.userId },
          {
            $set: {
              coinsEarned: result.coinResult.totalCoin
            }
          }
        );

        const userData = coinData.find(d => d.userId === result.userId);
        console.log(`   💰 User ${result.userId}: Rank ${userData?.rank} → +${result.coinResult.totalCoin} HTO (Base: ${result.coinResult.baseCoin}, Rank: +${result.coinResult.rankBonus}, Score: +${result.coinResult.scoreBonus}, Time: +${result.coinResult.timeBonus}${userData?.isFirstClear ? `, 🎉 First Clear: +${result.coinResult.firstClearBonus}` : ''})`);
      }

      console.log('💰 [finalizeArena] Coin assignment completed\n');
    } catch (error) {
      console.error('❌ [finalizeArena] Error assigning coins:', error);
      // 코인 부여 실패는 게임 종료를 막지 않음
    }

    // 모든 클라이언트에게 게임 종료 알림
    const endedPayload = {
      arenaId,
      winner: arena.winner ? {
        userId: arena.winner.toString(),
        solvedAt: arena.firstSolvedAt
      } : null,
      endTime: arena.endTime,
      message: 'Arena has ended'
    };

    console.log(`📢 [finalizeArena] Broadcasting arena:ended event to room ${arenaId}:`, endedPayload);
    io.to(arenaId).emit('arena:ended', endedPayload);
    console.log(`✅ [finalizeArena] arena:ended event broadcasted`);

    // 결과 페이지로 리다이렉션 신호 전송
    setTimeout(() => {
      io.to(arenaId).emit('arena:redirect-to-results', {
        arenaId,
        redirectUrl: `/arena/result/${arenaId}`
      });
      console.log(`🔄 [finalizeArena] Sent redirect signal to clients\n`);
    }, 2000);

  } catch (error) {
    console.error('❌ [finalizeArena] Error:', error);
    throw error;
  }
}