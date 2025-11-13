// handlers/defenseBattleHandler.ts
import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import { processDefenseBattleAction } from '../../services/defenseBattle/defenseBattleEngine';
import { endArenaProcedure } from '../utils/endArenaProcedure';

export const registerDefenseBattleHandlers = (io: Server, socket: Socket) => {
  
  /**
   * Defense Battle 액션 실행
   */
  socket.on('defenseBattle:execute', async ({ 
    actionName 
  }: { actionName: string }) => {
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;

    console.log(`\n⚔️ [defenseBattle:execute] Arena: ${arenaId}, User: ${userId}`);
    console.log(`   Action: "${actionName}"`);

    if (!arenaId || !userId) {
      socket.emit('defenseBattle:error', { message: 'Invalid request: missing arenaId or userId' });
      return;
    }

    try {
      // 1. Arena 상태 확인
      const arena = await Arena.findById(arenaId).populate('scenarioId');
      if (!arena) {
        socket.emit('defenseBattle:error', { message: 'Arena not found' });
        return;
      }
      if (arena.status !== 'started') {
        socket.emit('defenseBattle:error', { message: 'Arena has not started yet' });
        return;
      }

      // 2. 액션 처리 (defenseBattleEngine 호출)
      const result = await processDefenseBattleAction(arenaId, String(userId), actionName);
      
      console.log('📤 Engine Result:', result);

      if (!result.success) {
        socket.emit('arena:action-failed', { reason: result.message });
        return;
      }

      // 3. ArenaProgress 업데이트
      const updatePayload: any = {
        $inc: { score: result.scoreGain || 0 }
      };

      if (result.damage) {
        updatePayload.$inc.kills = 1;
      }

      // 액션 로그 추가
      updatePayload.$push = {
        actions: {
          actionType: result.actionType,
          actionName: actionName,
          damage: result.damage || 0,
          heal: result.heal || 0,
          timestamp: new Date()
        }
      };

      console.log('📝 Update Payload:', JSON.stringify(updatePayload, null, 2));

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
        score: progressDoc.score,
        kills: progressDoc.kills,
        team: progressDoc.teamName
      });
      console.log('---\n');

      // 4. 클라이언트에 결과 전송
      io.to(arenaId).emit('defenseBattle:result', {
        userId,
        actionName,
        message: result.message,
        scoreGain: result.scoreGain,
        damage: result.damage,
        heal: result.heal,
        shield: result.shield,
        gameState: result.gameState,
        totalScore: progressDoc.score
      });

      // 5. 전체 참가자 진행 상황 브로드캐스트
      io.to(arenaId).emit('participant:update', {
        userId: String(userId),
        progress: {
          score: progressDoc.score,
          kills: progressDoc.kills,
          team: progressDoc.teamName
        }
      });

      // 6. 게임 종료 처리
      if (result.gameOver) {
        console.log(`🏆 Game Over: Winner is ${result.winner}`);
        
        // Arena 모델에 승자 기록
        if (result.winnerUserId) {
          arena.winner = new mongoose.Types.ObjectId(result.winnerUserId);
          arena.firstSolvedAt = new Date();
          await arena.save();
        }
        
        // 게임 종료 프로시저
        await endArenaProcedure(arenaId, io);
      }

    } catch (e) {
      console.error('[defenseBattle:execute] error:', e);
      socket.emit('arena:action-failed', { 
        reason: (e as Error).message || 'An error occurred' 
      });
    }
  });

  /**
   * 게임 상태 조회
   */
  socket.on('defenseBattle:get-state', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    
    console.log('🔍 [defenseBattle:get-state] Request received:', { arenaId, userId });
    
    if (!arenaId || !userId) {
      console.warn('⚠️ [defenseBattle:get-state] Missing arenaId or userId');
      return;
    }

    try {
      // Arena에서 시나리오 정보 가져오기
      const arena = await Arena.findById(arenaId)
        .select('scenarioId status')
        .populate('scenarioId');
      
      if (!arena || !arena.scenarioId) {
        console.error('❌ [defenseBattle:get-state] Arena or scenario not found');
        socket.emit('defenseBattle:state-data', { 
          gameState: null,
          error: 'Arena not found'
        });
        return;
      }

      console.log('✅ [defenseBattle:get-state] Arena found:', arena._id);

      // 유저의 현재 진행 상황
      const progressDoc = await ArenaProgress.findOne({ arena: arenaId, user: userId });
      
      // 시나리오 데이터
      const scenario = arena.scenarioId as any;
      const scenarioData = scenario.data;

      // 게임 상태 계산
      const attackTeamProgress = await ArenaProgress.find({ 
        arena: arenaId, 
        teamName: 'ATTACK' 
      });
      
      const defenseTeamProgress = await ArenaProgress.find({ 
        arena: arenaId, 
        teamName: 'DEFENSE' 
      });

      const attackScore = attackTeamProgress.reduce((sum, p) => sum + (p.score || 0), 0);
      const defenseScore = defenseTeamProgress.reduce((sum, p) => sum + (p.score || 0), 0);

      // 1v1 체력 계산
      const totalAttackDamage = attackTeamProgress.reduce((sum, p) => {
        return sum + (p.actions?.reduce((actionSum: number, action: any) => 
          actionSum + (action.damage || 0), 0) || 0);
      }, 0);
      
      const totalDefenseHeal = defenseTeamProgress.reduce((sum, p) => {
        return sum + (p.actions?.reduce((actionSum: number, action: any) => 
          actionSum + (action.heal || 0), 0) || 0);
      }, 0);

      const attackerMaxHealth = 100;
      const attackerDamageTaken = defenseTeamProgress.reduce((sum, p) => {
        return sum + (p.actions?.reduce((actionSum: number, action: any) => 
          actionSum + (action.damage || 0), 0) || 0);
      }, 0);
      const attackerHealth = Math.max(0, attackerMaxHealth - attackerDamageTaken);

      const defenderMaxHealth = scenarioData.serverHealth || 200;
      const defenderHealth = Math.max(0, Math.min(defenderMaxHealth, 
        defenderMaxHealth - totalAttackDamage + totalDefenseHeal
      ));

      // 응답 데이터
      socket.emit('defenseBattle:state-data', {
        myTeam: progressDoc?.teamName || null,
        myRole: progressDoc?.teamRole || null,
        myScore: progressDoc?.score || 0,
        myKills: progressDoc?.kills || 0,
        attacker: {
          score: attackScore,
          health: attackerHealth,
          maxHealth: attackerMaxHealth
        },
        defender: {
          score: defenseScore,
          health: defenderHealth,
          maxHealth: defenderMaxHealth
        },
        availableActions: progressDoc?.teamRole === 'ATTACKER' 
          ? scenarioData.attackActions 
          : scenarioData.defenseActions
      });

      console.log('📤 [defenseBattle:get-state] Sent state to client');

    } catch (e) {
      console.error('[defenseBattle:get-state] error:', e);
      socket.emit('defenseBattle:state-data', { 
        gameState: null,
        error: 'Error loading state'
      });
    }
  });

  /**
   * 사용 가능한 액션 목록 조회
   */
  socket.on('defenseBattle:get-actions', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    
    if (!arenaId || !userId) return;

    try {
      const arena = await Arena.findById(arenaId)
        .select('scenarioId')
        .populate('scenarioId');
      
      const progressDoc = await ArenaProgress.findOne({ 
        arena: arenaId, 
        user: userId 
      }).lean();

      if (!progressDoc || !arena) {
        socket.emit('defenseBattle:actions-data', { actions: [] });
        return;
      }

      const scenario = arena.scenarioId as any;
      const actions = progressDoc.teamRole === 'ATTACKER' 
        ? scenario.data.attackActions 
        : scenario.data.defenseActions;

      socket.emit('defenseBattle:actions-data', { 
        actions: actions || [],
        team: progressDoc.teamName,
        role: progressDoc.teamRole
      });

    } catch (e) {
      console.error('[defenseBattle:get-actions] error:', e);
      socket.emit('defenseBattle:actions-data', { actions: [] });
    }
  });
};