// handlers/modes/KingOfTheHillHandler.ts
import { Server, Socket } from 'socket.io';
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import { 
  executeAttackAction, 
  executeDefenseAction, 
  getPlayerState, 
  getGameState,
  updateKingScore
} from '../../services/kingOfTheHill/KingOfTheHillEngine';
import { endArenaProcedure } from '../utils/endArenaProcedure';

/**
 * King of the Hill 게임 모드 핸들러 등록
 */
export const registerKingOfTheHillHandlers = (io: Server, socket: Socket) => {
  
  /**
   * 공격 액션 실행
   */
  socket.on('koth:attack', async ({ 
    actionId 
  }: { 
    actionId: string;
  }) => {
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;

    console.log(`\n⚔️ [koth:attack] Arena: ${arenaId}, User: ${userId}, Action: ${actionId}`);

    if (!arenaId || !userId) {
      socket.emit('koth:error', { message: 'Invalid request: missing arenaId or userId' });
      return;
    }

    if (!actionId) {
      socket.emit('koth:error', { message: 'Action ID is required' });
      return;
    }

    try {
      // 1. Arena 상태 확인
      const arena = await Arena.findById(arenaId).populate('scenarioId');
      if (!arena) {
        socket.emit('koth:error', { message: 'Arena not found' });
        return;
      }
      if (arena.status !== 'started') {
        socket.emit('koth:error', { message: 'Arena has not started yet' });
        return;
      }

      // 2. 공격 액션 실행
      const result = await executeAttackAction(arenaId, String(userId), actionId);
      
      console.log('📤 Attack Result:', result);

      if (!result.success) {
        socket.emit('koth:action-failed', { 
          reason: result.message,
          actionType: 'attack',
          actionName: result.actionName
        });
        return;
      }

      // 3. 클라이언트에 결과 전송
      socket.emit('koth:action-result', {
        actionType: 'attack',
        actionName: result.actionName,
        success: result.success,
        message: result.message,
        energyCost: result.energyCost,
        remainingEnergy: result.remainingEnergy,
        captureSuccess: result.captureSuccess,
        pointsGained: result.pointsGained,
        totalScore: result.totalScore
      });

      // 4. 왕좌 변경 시 전체 브로드캐스트
      if (result.captureSuccess) {
        io.to(arenaId).emit('koth:king-changed', {
          newKing: userId,
          previousKing: arena.modeSettings?.kingOfTheHill?.currentKing,
          timestamp: new Date()
        });
        
        console.log(`   👑 Broadcasting king change: ${userId}`);
      }

      // 5. 전체 참가자에게 상태 업데이트 브로드캐스트
      const gameState = await getGameState(arenaId);
      if (gameState) {
        io.to(arenaId).emit('koth:game-state-update', gameState);
      }

    } catch (e) {
      console.error('[koth:attack] error:', e);
      socket.emit('koth:error', { 
        message: (e as Error).message || 'An error occurred' 
      });
    }
  });

  /**
   * 방어 액션 실행
   */
  socket.on('koth:defend', async ({ 
    actionId 
  }: { 
    actionId: string;
  }) => {
    const arenaId = (socket as any).arenaId;
    const userId = (socket as any).userId;

    console.log(`\n🛡️ [koth:defend] Arena: ${arenaId}, User: ${userId}, Action: ${actionId}`);

    if (!arenaId || !userId) {
      socket.emit('koth:error', { message: 'Invalid request: missing arenaId or userId' });
      return;
    }

    if (!actionId) {
      socket.emit('koth:error', { message: 'Action ID is required' });
      return;
    }

    try {
      // 1. Arena 상태 확인
      const arena = await Arena.findById(arenaId).populate('scenarioId');
      if (!arena) {
        socket.emit('koth:error', { message: 'Arena not found' });
        return;
      }
      if (arena.status !== 'started') {
        socket.emit('koth:error', { message: 'Arena has not started yet' });
        return;
      }

      // 2. 방어 액션 실행
      const result = await executeDefenseAction(arenaId, String(userId), actionId);
      
      console.log('📤 Defense Result:', result);

      if (!result.success) {
        socket.emit('koth:action-failed', { 
          reason: result.message,
          actionType: 'defense',
          actionName: result.actionName
        });
        return;
      }

      // 3. 클라이언트에 결과 전송
      socket.emit('koth:action-result', {
        actionType: 'defense',
        actionName: result.actionName,
        success: result.success,
        message: result.message,
        energyCost: result.energyCost,
        remainingEnergy: result.remainingEnergy,
        defenseBonus: result.defenseBonus
      });

      // 4. 전체 참가자에게 상태 업데이트 브로드캐스트
      const gameState = await getGameState(arenaId);
      if (gameState) {
        io.to(arenaId).emit('koth:game-state-update', gameState);
      }

    } catch (e) {
      console.error('[koth:defend] error:', e);
      socket.emit('koth:error', { 
        message: (e as Error).message || 'An error occurred' 
      });
    }
  });

  /**
   * 플레이어 상태 조회
   */
  socket.on('koth:get-player-state', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    
    console.log('📊 [koth:get-player-state] Request received:', { arenaId, userId });
    
    if (!arenaId || !userId) {
      console.warn('⚠️ [koth:get-player-state] Missing arenaId or userId');
      return;
    }

    try {
      const playerState = await getPlayerState(arenaId, userId);
      
      if (!playerState) {
        socket.emit('koth:player-state-data', {
          userId,
          score: 0,
          energy: 100,
          isKing: false,
          kingTime: 0,
          timesKing: 0,
          attacksSucceeded: 0,
          attacksFailed: 0
        });
        return;
      }

      socket.emit('koth:player-state-data', playerState);
      console.log('📤 [koth:get-player-state] Sent player state to client');

    } catch (e) {
      console.error('[koth:get-player-state] error:', e);
      socket.emit('koth:player-state-data', {
        userId,
        score: 0,
        energy: 100,
        isKing: false,
        kingTime: 0,
        timesKing: 0,
        attacksSucceeded: 0,
        attacksFailed: 0
      });
    }
  });

  /**
   * 게임 전체 상태 조회
   */
  socket.on('koth:get-game-state', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    
    console.log('🎮 [koth:get-game-state] Request received:', { arenaId, userId });
    
    if (!arenaId || !userId) {
      console.warn('⚠️ [koth:get-game-state] Missing arenaId or userId');
      return;
    }

    try {
      const gameState = await getGameState(arenaId);
      
      if (!gameState) {
        socket.emit('koth:game-state-data', {
          currentKing: null,
          kingCrownedAt: null,
          defenseLevel: 0,
          players: []
        });
        return;
      }

      socket.emit('koth:game-state-data', gameState);
      console.log('📤 [koth:get-game-state] Sent game state to client');

    } catch (e) {
      console.error('[koth:get-game-state] error:', e);
      socket.emit('koth:game-state-data', {
        currentKing: null,
        kingCrownedAt: null,
        defenseLevel: 0,
        players: []
      });
    }
  });

  /**
   * 시나리오 정보 조회 (공격/방어 액션 목록)
   */
  socket.on('koth:get-scenario', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    
    console.log('📋 [koth:get-scenario] Request received:', { arenaId, userId });
    
    if (!arenaId || !userId) {
      console.warn('⚠️ [koth:get-scenario] Missing arenaId or userId');
      return;
    }

    try {
      const arena = await Arena.findById(arenaId)
        .select('scenarioId')
        .populate('scenarioId');
      
      if (!arena || !arena.scenarioId) {
        console.error('❌ [koth:get-scenario] Arena or scenario not found');
        socket.emit('koth:scenario-data', { scenario: null });
        return;
      }

      console.log('✅ [koth:get-scenario] Arena found:', arena._id);

      const scenario = arena.scenarioId as any;
      const scenarioData = scenario.data;

      socket.emit('koth:scenario-data', {
        serverInfo: scenarioData.serverInfo,
        attackActions: scenarioData.attackActions,
        defenseActions: scenarioData.defenseActions,
        scoring: scenarioData.scoring,
        energySettings: scenarioData.energySettings
      });

      console.log('📤 [koth:get-scenario] Sent scenario data to client');

    } catch (e) {
      console.error('[koth:get-scenario] error:', e);
      socket.emit('koth:scenario-data', { scenario: null });
    }
  });

  /**
   * 리더보드 조회
   */
  socket.on('koth:get-leaderboard', async ({ arenaId }: { arenaId: string }) => {
    const userId = (socket as any).userId;
    
    console.log('🏆 [koth:get-leaderboard] Request received:', { arenaId, userId });
    
    if (!arenaId || !userId) {
      console.warn('⚠️ [koth:get-leaderboard] Missing arenaId or userId');
      return;
    }

    try {
      const arena = await Arena.findById(arenaId);
      if (!arena) {
        socket.emit('koth:leaderboard-data', { leaderboard: [] });
        return;
      }

      // 모든 참가자의 진행 상황 가져오기
      const progressDocs = await ArenaProgress.find({ 
        arena: arenaId 
      })
        .populate('user', 'username')
        .sort({ score: -1 })
        .lean();

      const leaderboard = progressDocs.map((doc: any, index: number) => ({
        rank: index + 1,
        userId: doc.user._id,
        username: doc.user.username,
        score: doc.score || 0,
        kingTime: doc.kingOfTheHill?.totalKingTime || 0,
        isCurrentKing: arena.modeSettings?.kingOfTheHill?.currentKing && 
                       String(arena.modeSettings.kingOfTheHill.currentKing) === String(doc.user._id)
      }));

      socket.emit('koth:leaderboard-data', { leaderboard });
      console.log('📤 [koth:get-leaderboard] Sent leaderboard to client');

    } catch (e) {
      console.error('[koth:get-leaderboard] error:', e);
      socket.emit('koth:leaderboard-data', { leaderboard: [] });
    }
  });
};

/**
 * King of the Hill 게임 틱 시스템 (1초마다 실행)
 * - 왕의 점수 자동 증가
 * - 게임 상태 브로드캐스트
 */
export const startKingOfTheHillTick = (io: Server, arenaId: string) => {
  const intervalId = setInterval(async () => {
    try {
      const arena = await Arena.findById(arenaId);
      
      if (!arena || arena.status !== 'started') {
        console.log(`[KOTH Tick] Stopping tick for arena ${arenaId} (status: ${arena?.status})`);
        clearInterval(intervalId);
        return;
      }

      // 왕 점수 업데이트
      await updateKingScore(arenaId);

      // 게임 상태 브로드캐스트
      const gameState = await getGameState(arenaId);
      if (gameState) {
        io.to(arenaId).emit('koth:game-state-update', gameState);
      }

      // 제한 시간 체크
      const now = new Date();
      const startTime = arena.startTime;
      if (startTime) {
        const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const timeLimit = arena.timeLimit || 900; // 기본 15분

        if (elapsedSeconds >= timeLimit) {
          console.log(`[KOTH Tick] Time limit reached for arena ${arenaId}`);
          
          // 최고 점수 플레이어를 승자로 설정
          const progressDocs = await ArenaProgress.find({ 
            arena: arenaId 
          }).sort({ score: -1 }).limit(1);

          if (progressDocs.length > 0) {
            arena.winner = progressDocs[0].user;
            arena.status = 'ended';
            await arena.save();
            
            await endArenaProcedure(arenaId, io);
          }
          
          clearInterval(intervalId);
        }
      }

    } catch (error) {
      console.error('[KOTH Tick] error:', error);
    }
  }, 1000); // 1초마다 실행

  console.log(`✅ [KOTH Tick] Started for arena ${arenaId}`);
  
  return intervalId;
};