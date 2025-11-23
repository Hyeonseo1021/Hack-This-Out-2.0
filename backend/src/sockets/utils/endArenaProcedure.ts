// handlers/utils/endArenaProcedure.ts

import { Server } from 'socket.io';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';

// 진행 중인 유예 타이머 추적
const graceTimers = new Map<string, NodeJS.Timeout>();

/**
 * ✅ 모든 참가자가 완료했는지 확인
 */
async function checkAllParticipantsCompleted(arenaId: string): Promise<boolean> {
  const progressDocs = await ArenaProgress.find({ arena: arenaId });
  
  if (progressDocs.length === 0) return false;
  
  // 모든 참가자가 완료했는지 확인
  const allCompleted = progressDocs.every(p => p.completed === true);
  
  console.log(`📊 [checkAllParticipantsCompleted] ${progressDocs.length} participants, all completed: ${allCompleted}`);
  
  return allCompleted;
}

/**
 * ✅ Arena 즉시 종료 (유예 시간 없이)
 */
export async function endArenaImmediately(arenaId: string, io: Server) {
  console.log(`\n🏁 [endArenaImmediately] Ending arena: ${arenaId}`);
  
  // 기존 유예 타이머 취소
  if (graceTimers.has(arenaId)) {
    clearTimeout(graceTimers.get(arenaId)!);
    graceTimers.delete(arenaId);
    console.log('⏹️ Cancelled existing grace timer');
  }

  await finalizeArena(arenaId, io);
}

/**
 * ✅ Arena 종료 프로시저 (유예 시간 적용)
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
    const graceMs = arena.settings?.graceMs ?? 90000;

    console.log(`⚙️ Settings: endOnFirstSolve=${endOnFirstSolve}, graceMs=${graceMs}`);

    // endOnFirstSolve가 false면 바로 종료하지 않음
    if (!endOnFirstSolve) {
      console.log('⏸️ endOnFirstSolve is false, waiting for time limit or all complete');
      return;
    }

    // graceMs가 0이면 즉시 종료
    if (graceMs === 0) {
      console.log('⚡ No grace period, ending immediately');
      await endArenaImmediately(arenaId, io);
      return;
    }

    // ✅ 유예 시간 시작
    console.log(`⏳ Starting grace period: ${graceMs}ms (${graceMs / 1000}s)`);
    
    // 모든 참가자에게 유예 시간 알림
    io.to(arenaId).emit('arena:grace-period-started', {
      graceMs,
      graceSec: Math.floor(graceMs / 1000),
      message: `First player completed! You have ${Math.floor(graceMs / 1000)} seconds to finish.`
    });

    // 유예 타이머 설정
    const timer = setTimeout(async () => {
      console.log(`⏰ [Grace Timer] Grace period ended for arena: ${arenaId}`);
      graceTimers.delete(arenaId);
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
      
      // 유예 타이머 취소하고 즉시 종료
      clearTimeout(graceTimers.get(arenaId)!);
      graceTimers.delete(arenaId);
      
      await finalizeArena(arenaId, io);
    } else {
      console.log('⏳ Not all participants completed yet, waiting...');
    }
  } catch (error) {
    console.error('❌ [checkAndEndIfAllCompleted] Error:', error);
  }
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

    // 모든 참가자의 진행 상황 조회
    const progressDocs = await ArenaProgress.find({ arena: arenaId });
    console.log(`👥 [finalizeArena] Found ${progressDocs.length} participants`);

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

    // 모든 클라이언트에게 게임 종료 알림
    io.to(arenaId).emit('arena:ended', {
      arenaId,
      winner: arena.winner ? {
        userId: arena.winner.toString(),
        solvedAt: arena.firstSolvedAt
      } : null,
      endTime: arena.endTime,
      message: 'Arena has ended'
    });

    console.log(`📢 [finalizeArena] Broadcasted arena:ended event`);

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