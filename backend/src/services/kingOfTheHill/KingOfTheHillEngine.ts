// services/kingOfTheHill/KingOfTheHillEngine.ts
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import { KingOfTheHillData } from '../../types/ArenaScenarioData';

/**
 * 액션 실행 결과 인터페이스
 */
export interface ActionResult {
  success: boolean;
  message: string;
  actionType: 'attack' | 'defense';
  actionName: string;
  energyCost: number;
  remainingEnergy: number;
  
  // 공격 액션 결과
  captureSuccess?: boolean;
  pointsGained?: number;
  
  // 방어 액션 결과
  defenseBonus?: number;
  
  // 게임 상태
  currentKing?: string | null;
  totalScore?: number;
  kingTime?: number;
}

/**
 * 플레이어 상태 조회 결과
 */
export interface PlayerState {
  userId: string;
  score: number;
  energy: number;
  isKing: boolean;
  kingTime: number;
  timesKing: number;
  attacksSucceeded: number;
  attacksFailed: number;
}

/**
 * 게임 전체 상태 조회 결과
 */
export interface GameState {
  currentKing: string | null;
  kingCrownedAt: Date | null;
  defenseLevel: number;
  players: PlayerState[];
}

/**
 * 공격 액션 실행
 */
export const executeAttackAction = async (
  arenaId: string,
  userId: string,
  actionId: string
): Promise<ActionResult> => {
  
  console.log(`\n⚔️ [kingOfTheHillEngine] Attack action execution`);
  console.log(`   Arena: ${arenaId}, User: ${userId}, Action: ${actionId}`);
  
  try {
    // 1. Arena 및 Scenario 가져오기
    const arena = await Arena.findById(arenaId).populate('scenarioId');
    if (!arena || !arena.scenarioId) {
      return {
        success: false,
        message: 'Arena or scenario not found',
        actionType: 'attack',
        actionName: '',
        energyCost: 0,
        remainingEnergy: 0
      };
    }

    const scenario = arena.scenarioId as any;
    const scenarioData: KingOfTheHillData = scenario.data;
    
    // 2. 액션 찾기
    const action = scenarioData.attackActions.find(a => a.id === actionId);
    if (!action) {
      return {
        success: false,
        message: 'Attack action not found',
        actionType: 'attack',
        actionName: '',
        energyCost: 0,
        remainingEnergy: 0
      };
    }

    console.log(`   Action: ${action.name} (Cost: ${action.energyCost}, Success Rate: ${action.successRate}%)`);

    // 3. 유저의 진행 상황 가져오기
    let progressDoc = await ArenaProgress.findOne({ 
      arena: arenaId, 
      user: userId 
    });

    if (!progressDoc) {
      // 진행 상황이 없으면 생성
      progressDoc = await ArenaProgress.create({
        arena: arenaId,
        user: userId,
        score: 0,
        stage: 0,
        kingOfTheHill: {
          totalKingTime: 0,
          longestKingStreak: 0,
          timesKing: 0,
          timesDethroned: 0,
          attacksSucceeded: 0,
          attacksFailed: 0,
          defensesSucceeded: 0,
          defensesFailed: 0,
          firstBlood: false,
          kingDurations: []
        }
      });
    }

    // 4. 에너지 시스템 (간단하게 처리)
    const currentEnergy = 100;

    // 5. 에너지 충분한지 확인
    if (currentEnergy < action.energyCost) {
      return {
        success: false,
        message: `Not enough energy. Required: ${action.energyCost}, Available: ${currentEnergy}`,
        actionType: 'attack',
        actionName: action.name,
        energyCost: action.energyCost,
        remainingEnergy: currentEnergy
      };
    }

    // 6. 게임 상태 가져오기 (현재 왕, 방어 레벨)
    if (!arena.modeSettings) {
      arena.modeSettings = {} as any;
    }
    if (!arena.modeSettings.kingOfTheHill) {
      // DocumentArray 초기화 문제를 피하기 위해 Arena 업데이트 사용
      await Arena.findByIdAndUpdate(arenaId, {
        $set: {
          'modeSettings.kingOfTheHill': {
            currentKing: null,
            kingCrownedAt: null,
            defenseLevel: 0,
            kingChanges: [],
            playerScores: []
          }
        }
      });
      
      // Arena 재조회
      const updatedArena = await Arena.findById(arenaId);
      if (!updatedArena) {
        return {
          success: false,
          message: 'Failed to initialize game state',
          actionType: 'attack',
          actionName: action.name,
          energyCost: 0,
          remainingEnergy: 0
        };
      }
      arena.modeSettings = updatedArena.modeSettings;
    }

    const kingState = arena.modeSettings.kingOfTheHill!;

    // 7. 공격 성공 여부 결정
    let effectiveSuccessRate = action.successRate;
    
    // 방어 레벨에 따른 성공률 감소
    if (kingState.currentKing && String(kingState.currentKing) !== userId) {
      effectiveSuccessRate = Math.max(10, effectiveSuccessRate - (kingState.defenseLevel || 0));
    }

    const successRoll = Math.random() * 100;
    const isSuccess = successRoll < effectiveSuccessRate;

    console.log(`   Success Roll: ${successRoll.toFixed(1)} vs ${effectiveSuccessRate.toFixed(1)} => ${isSuccess ? 'SUCCESS' : 'FAIL'}`);

    let pointsGained = 0;
    let captureSuccess = false;
    let newKing: string | null = kingState.currentKing ? String(kingState.currentKing) : null;

    if (isSuccess) {
      if (action.effect === 'capture') {
        // 왕좌 점령 시도
        if (String(kingState.currentKing) !== userId) {
          const now = new Date();
          
          // 이전 왕의 왕좌 시간 업데이트
          if (kingState.currentKing && kingState.kingCrownedAt) {
            const prevKingTime = Math.floor((now.getTime() - kingState.kingCrownedAt.getTime()) / 1000);
            
            await ArenaProgress.findOneAndUpdate(
              { arena: arenaId, user: kingState.currentKing },
              { 
                $inc: { 
                  'kingOfTheHill.totalKingTime': prevKingTime,
                  'kingOfTheHill.timesDethroned': 1
                },
                $push: {
                  'kingOfTheHill.kingDurations': {
                    crownedAt: kingState.kingCrownedAt,
                    dethronedAt: now,
                    duration: prevKingTime
                  }
                }
              }
            );
          }
          
          // 새로운 왕 등극
          const previousKing = kingState.currentKing;
          newKing = userId;
          
          // 왕좌 변경 기록을 먼저 업데이트
          await Arena.findByIdAndUpdate(arenaId, {
            $set: {
              'modeSettings.kingOfTheHill.currentKing': userId,
              'modeSettings.kingOfTheHill.kingCrownedAt': now,
              'modeSettings.kingOfTheHill.defenseLevel': 0
            },
            $push: {
              'modeSettings.kingOfTheHill.kingChanges': {
                previousKing,
                newKing: userId,
                timestamp: now
              }
            }
          });
          
          // 로컬 객체도 업데이트
          kingState.currentKing = userId as any;
          kingState.kingCrownedAt = now;
          kingState.defenseLevel = 0;
          
          pointsGained = scenarioData.scoring.captureBonus;
          captureSuccess = true;
          
          // 첫 점령인지 확인 (firstBlood가 없고, 이번이 첫 점령인 경우)
          const isFirstBlood = !progressDoc.kingOfTheHill?.firstBlood;
          
          if (isFirstBlood) {
            pointsGained += scenarioData.scoring.firstCaptureBonus;
            await ArenaProgress.findOneAndUpdate(
              { arena: arenaId, user: userId },
              { $set: { 'kingOfTheHill.firstBlood': true } }
            );
            console.log(`   🩸 First Blood! Bonus: +${scenarioData.scoring.firstCaptureBonus}`);
          }
          
          console.log(`   👑 New King: ${userId}`);
        }
      } else if (action.effect === 'points' && action.points) {
        // 직접 점수 획득
        pointsGained = action.points;
      }
    }

    // 8. ArenaProgress 업데이트
    const updateData: any = {
      $inc: {}
    };

    if (isSuccess) {
      updateData.$inc['kingOfTheHill.attacksSucceeded'] = 1;
      if (captureSuccess) {
        updateData.$inc['kingOfTheHill.timesKing'] = 1;
      }
    } else {
      updateData.$inc['kingOfTheHill.attacksFailed'] = 1;
    }

    if (pointsGained > 0) {
      updateData.$inc.score = pointsGained;
    }

    const updatedProgress = await ArenaProgress.findOneAndUpdate(
      { arena: arenaId, user: userId },
      updateData,
      { new: true }
    );

    // 9. 결과 반환 (Arena는 이미 위에서 업데이트됨)
    return {
      success: true,
      message: isSuccess 
        ? (captureSuccess ? `👑 Server captured! +${pointsGained} points` : `Success! +${pointsGained} points`)
        : 'Attack failed',
      actionType: 'attack',
      actionName: action.name,
      energyCost: action.energyCost,
      remainingEnergy: currentEnergy - action.energyCost,
      captureSuccess,
      pointsGained,
      currentKing: newKing,
      totalScore: updatedProgress.score
    };

  } catch (error) {
    console.error(`   ❌ Error in executeAttackAction:`, error);
    return {
      success: false,
      message: `Internal error: ${(error as Error).message}`,
      actionType: 'attack',
      actionName: '',
      energyCost: 0,
      remainingEnergy: 0
    };
  }
};

/**
 * 방어 액션 실행
 */
export const executeDefenseAction = async (
  arenaId: string,
  userId: string,
  actionId: string
): Promise<ActionResult> => {
  
  console.log(`\n🛡️ [kingOfTheHillEngine] Defense action execution`);
  console.log(`   Arena: ${arenaId}, User: ${userId}, Action: ${actionId}`);
  
  try {
    // 1. Arena 및 Scenario 가져오기
    const arena = await Arena.findById(arenaId).populate('scenarioId');
    if (!arena || !arena.scenarioId) {
      return {
        success: false,
        message: 'Arena or scenario not found',
        actionType: 'defense',
        actionName: '',
        energyCost: 0,
        remainingEnergy: 0
      };
    }

    const scenario = arena.scenarioId as any;
    const scenarioData: KingOfTheHillData = scenario.data;
    
    // 2. 액션 찾기
    const action = scenarioData.defenseActions.find(a => a.id === actionId);
    if (!action) {
      return {
        success: false,
        message: 'Defense action not found',
        actionType: 'defense',
        actionName: '',
        energyCost: 0,
        remainingEnergy: 0
      };
    }

    console.log(`   Action: ${action.name} (Cost: ${action.energyCost})`);

    // 3. 현재 왕인지 확인
    const kingState = arena.modeSettings?.kingOfTheHill;

    if (!kingState || String(kingState.currentKing) !== userId) {
      return {
        success: false,
        message: 'Only the current king can use defense actions',
        actionType: 'defense',
        actionName: action.name,
        energyCost: 0,
        remainingEnergy: 0
      };
    }

    // 4. 유저의 진행 상황 가져오기
    let progressDoc = await ArenaProgress.findOne({ 
      arena: arenaId, 
      user: userId 
    });

    if (!progressDoc) {
      return {
        success: false,
        message: 'Progress not found',
        actionType: 'defense',
        actionName: action.name,
        energyCost: 0,
        remainingEnergy: 0
      };
    }

    const currentEnergy = 100;

    // 5. 에너지 충분한지 확인
    if (currentEnergy < action.energyCost) {
      return {
        success: false,
        message: `Not enough energy. Required: ${action.energyCost}, Available: ${currentEnergy}`,
        actionType: 'defense',
        actionName: action.name,
        energyCost: action.energyCost,
        remainingEnergy: currentEnergy
      };
    }

    // 6. 방어 효과 적용
    let defenseBonus = 0;
    const updateFields: any = {};

    if (action.effect === 'defenseLevel' && action.defenseBonus) {
      defenseBonus = action.defenseBonus;
      updateFields['modeSettings.kingOfTheHill.defenseLevel'] = (kingState.defenseLevel || 0) + action.defenseBonus;
      console.log(`   📈 Defense Level: ${(kingState.defenseLevel || 0) + action.defenseBonus}`);
    } else if (action.effect === 'block' && action.blockChance) {
      // blockChance는 defenseLevel로 통합
      defenseBonus = Math.floor(action.blockChance / 2);
      updateFields['modeSettings.kingOfTheHill.defenseLevel'] = (kingState.defenseLevel || 0) + defenseBonus;
      console.log(`   🛡️ Defense Level increased by: ${defenseBonus}`);
    }

    // 7. Arena 업데이트
    await Arena.findByIdAndUpdate(arenaId, { $set: updateFields });

    // 8. ArenaProgress 업데이트
    await ArenaProgress.findOneAndUpdate(
      { arena: arenaId, user: userId },
      {
        $inc: {
          'kingOfTheHill.defensesSucceeded': 1
        }
      }
    );

    // 9. 결과 반환
    return {
      success: true,
      message: `Defense strengthened! -${action.energyCost} energy`,
      actionType: 'defense',
      actionName: action.name,
      energyCost: action.energyCost,
      remainingEnergy: currentEnergy - action.energyCost,
      defenseBonus
    };

  } catch (error) {
    console.error(`   ❌ Error in executeDefenseAction:`, error);
    return {
      success: false,
      message: `Internal error: ${(error as Error).message}`,
      actionType: 'defense',
      actionName: '',
      energyCost: 0,
      remainingEnergy: 0
    };
  }
};

/**
 * 플레이어 상태 조회
 */
export const getPlayerState = async (
  arenaId: string,
  userId: string
): Promise<PlayerState | null> => {
  try {
    const arena = await Arena.findById(arenaId).populate('scenarioId');
    if (!arena || !arena.scenarioId) {
      return null;
    }

    const progressDoc = await ArenaProgress.findOne({ 
      arena: arenaId, 
      user: userId 
    }).lean();

    if (!progressDoc) {
      return {
        userId,
        score: 0,
        energy: 100,
        isKing: false,
        kingTime: 0,
        timesKing: 0,
        attacksSucceeded: 0,
        attacksFailed: 0
      };
    }

    // 왕좌 시간 계산
    const kingState = arena.modeSettings?.kingOfTheHill;
    const isKing = kingState?.currentKing && String(kingState.currentKing) === userId;
    let totalKingTime = progressDoc.kingOfTheHill?.totalKingTime || 0;
    
    if (isKing && kingState?.kingCrownedAt) {
      const now = new Date();
      const currentKingTime = Math.floor((now.getTime() - kingState.kingCrownedAt.getTime()) / 1000);
      totalKingTime += currentKingTime;
    }

    return {
      userId,
      score: progressDoc.score || 0,
      energy: 100,
      isKing,
      kingTime: totalKingTime,
      timesKing: progressDoc.kingOfTheHill?.timesKing || 0,
      attacksSucceeded: progressDoc.kingOfTheHill?.attacksSucceeded || 0,
      attacksFailed: progressDoc.kingOfTheHill?.attacksFailed || 0
    };

  } catch (error) {
    console.error('[getPlayerState] error:', error);
    return null;
  }
};

/**
 * 게임 전체 상태 조회
 */
export const getGameState = async (
  arenaId: string
): Promise<GameState | null> => {
  try {
    const arena = await Arena.findById(arenaId);
    if (!arena) {
      return null;
    }

    const kingState = arena.modeSettings?.kingOfTheHill;

    // 모든 참가자의 상태 가져오기
    const participants = arena.participants || [];
    const playerStates: PlayerState[] = [];

    for (const participant of participants) {
      const userId = String(participant.user);
      const state = await getPlayerState(arenaId, userId);
      if (state) {
        playerStates.push(state);
      }
    }

    return {
      currentKing: kingState?.currentKing ? String(kingState.currentKing) : null,
      kingCrownedAt: kingState?.kingCrownedAt || null,
      defenseLevel: kingState?.defenseLevel || 0,
      players: playerStates
    };

  } catch (error) {
    console.error('[getGameState] error:', error);
    return null;
  }
};

/**
 * 왕좌 점수 자동 증가 (백그라운드 작업)
 */
export const updateKingScore = async (
  arenaId: string
): Promise<void> => {
  try {
    const arena = await Arena.findById(arenaId).populate('scenarioId');
    if (!arena || !arena.scenarioId) {
      return;
    }

    const scenario = arena.scenarioId as any;
    const scenarioData: KingOfTheHillData = scenario.data;
    const kingState = arena.modeSettings?.kingOfTheHill;

    if (!kingState?.currentKing || !kingState.kingCrownedAt) {
      return;
    }

    const now = new Date();
    const kingTime = Math.floor((now.getTime() - kingState.kingCrownedAt.getTime()) / 1000);
    
    // 점수 계산 (초당 점수)
    const pointsToAdd = scenarioData.scoring.pointsPerSecond;

    // 마일스톤 보너스 체크
    let bonusPoints = 0;
    const progress = await ArenaProgress.findOne({ 
      arena: arenaId, 
      user: kingState.currentKing 
    });

    if (progress) {
      const totalKingTime = (progress.kingOfTheHill?.totalKingTime || 0) + kingTime;
      
      // 5초 유지 보너스 (한 번만)
      if (totalKingTime >= 5 && kingTime <= 6 && kingTime >= 5) {
        bonusPoints += scenarioData.scoring.fiveSecondBonus;
        console.log(`   🎉 5-second bonus: +${scenarioData.scoring.fiveSecondBonus}`);
      }
      
      // 1분 유지 보너스 (한 번만)
      if (totalKingTime >= 60 && kingTime <= 61 && kingTime >= 60) {
        bonusPoints += scenarioData.scoring.oneMinuteBonus;
        console.log(`   🎉 1-minute bonus: +${scenarioData.scoring.oneMinuteBonus}`);
      }
    }

    // 점수 업데이트
    if (pointsToAdd > 0 || bonusPoints > 0) {
      await ArenaProgress.findOneAndUpdate(
        { arena: arenaId, user: kingState.currentKing },
        { $inc: { score: pointsToAdd + bonusPoints } }
      );
    }

  } catch (error) {
    console.error('[updateKingScore] error:', error);
  }
};