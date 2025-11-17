// services/defenseBattle/defenseBattleEngine.ts
import ArenaProgress from '../../models/ArenaProgress';
import Arena from '../../models/Arena';
import { CyberDefenseBattleData } from '../../types/ArenaScenarioData';

interface ActionResult {
  success: boolean;
  message: string;
  scoreGain?: number;
  damage?: number;
  heal?: number;
  shield?: number;
  actionType?: 'attack' | 'defense';
  gameState?: any;
  gameOver?: boolean;
  winner?: string;
  winnerUserId?: string;
}

/**
 * Defense Battle 액션 처리
 * 🔥 수정: 체력 계산 로직 제거 (Handler에서 처리)
 */
export async function processDefenseBattleAction(
  arenaId: string,
  userId: string,
  actionName: string
): Promise<ActionResult> {
  
  // 1. Arena 및 시나리오 가져오기
  const arena = await Arena.findById(arenaId).populate('scenarioId');
  if (!arena) {
    return { success: false, message: 'Arena not found' };
  }

  const scenario = arena.scenarioId as any;
  const scenarioData: CyberDefenseBattleData = scenario.data;

  // 2. 유저의 진행 상황 가져오기
  const userProgress = await ArenaProgress.findOne({ arena: arenaId, user: userId });
  if (!userProgress) {
    return { success: false, message: 'User progress not found' };
  }

  const userTeam = userProgress.teamName;
  const userRole = userProgress.teamRole;

  if (!userTeam || !userRole) {
    return { success: false, message: 'User not assigned to a team' };
  }

  // 3. 액션 찾기
  let actionData: any;
  let actionType: 'attack' | 'defense';

  if (userRole === 'ATTACKER') {
    actionData = scenarioData.attackActions.find(a => a.name === actionName);
    actionType = 'attack';
  } else {
    actionData = scenarioData.defenseActions.find(a => a.name === actionName);
    actionType = 'defense';
  }

  if (!actionData) {
    return { success: false, message: 'Invalid action' };
  }

  // 4. 쿨다운 체크 (개선: 특정 액션의 마지막 사용 시간 기반)
  const actionsOfType = userProgress.actions.filter(a => a.actionName === actionName);
  if (actionsOfType.length > 0) {
    const lastActionOfType = actionsOfType[actionsOfType.length - 1];
    const timeSinceLastAction = Date.now() - new Date(lastActionOfType.timestamp).getTime();
    const cooldownMs = (actionData.cooldown || 0) * 1000; // 초를 밀리초로

    if (timeSinceLastAction < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastAction) / 1000);
      return {
        success: false,
        message: `Action on cooldown. ${remainingSeconds}s remaining.`
      };
    }
  }

  // 5. 액션 실행
  let damage = 0;
  let heal = 0;
  let shield = 0;
  let scoreGain = 0;

  if (actionType === 'attack') {
    damage = actionData.damage || 0;
    scoreGain = Math.floor(damage / 10);  // 공격: 10 데미지 = 1점
  } else {
    heal = actionData.heal || 0;
    shield = actionData.shield || 0;
    scoreGain = Math.floor((heal + shield) / 10);  // ✅ 방어도 공격과 동일한 비율로 변경
  }

  // 6. 게임 종료 조건 체크
  // 🔥 수정: 체력은 Handler에서 관리하므로 여기서는 시간/점수만 체크
  const attackTeamProgress = await ArenaProgress.find({ 
    arena: arenaId, 
    teamName: 'ATTACK' 
  });
  
  const defenseTeamProgress = await ArenaProgress.find({ 
    arena: arenaId, 
    teamName: 'DEFENSE' 
  });

  const attackScore = attackTeamProgress.reduce((sum, p) => sum + (p.score || 0), 0) + 
    (userTeam === 'ATTACK' ? scoreGain : 0);
  const defenseScore = defenseTeamProgress.reduce((sum, p) => sum + (p.score || 0), 0) + 
    (userTeam === 'DEFENSE' ? scoreGain : 0);

  // 7. 게임 종료 조건 체크
  const gameOver = checkGameOver(arena, attackScore, defenseScore);
  let winner: string | undefined;
  let winnerUserId: string | undefined;

  if (gameOver) {
    winner = determineWinner(attackScore, defenseScore);

    // ✅ 1:1 매치이므로 승리팀의 유저가 승자
    if (winner === 'ATTACK' && attackTeamProgress.length > 0) {
      winnerUserId = attackTeamProgress[0].user.toString();
    } else if (winner === 'DEFENSE' && defenseTeamProgress.length > 0) {
      winnerUserId = defenseTeamProgress[0].user.toString();
    }
  }

  // 8. 결과 반환 (체력은 Handler에서 계산)
  return {
    success: true,
    message: `${actionName} executed successfully!`,
    scoreGain,
    damage,
    heal,
    shield,
    actionType,
    gameOver,
    winner,
    winnerUserId
  };
}

/**
 * 게임 종료 조건 체크
 * 🔥 수정: 체력 체크 제거 (Handler에서 처리)
 */
function checkGameOver(arena: any, attackScore: number, defenseScore: number): boolean {
  // 시간 초과 체크
  if (arena.startTime) {
    const elapsedMs = Date.now() - new Date(arena.startTime).getTime();
    const timeLimitMs = arena.timeLimit * 1000;
    
    if (elapsedMs >= timeLimitMs) {
      return true;
    }
  }

  // 점수 기반 승리 조건 (예: 500점 달성)
  if (attackScore >= 500 || defenseScore >= 500) {
    return true;
  }

  // 🔥 체력 0 체크는 Handler에서 처리
  
  return false;
}

/**
 * 승자 결정
 */
function determineWinner(attackScore: number, defenseScore: number): string {
  if (attackScore > defenseScore) return 'ATTACK';
  if (defenseScore > attackScore) return 'DEFENSE';
  return 'DRAW';
}

/**
 * 팀 초기화 (게임 시작 시 호출)
 * ✅ 1:1 매치: 정확히 2명만 참가 가능
 * 🔥 수정: health 필드 초기화 추가
 */
export async function initializeDefenseBattleTeams(arenaId: string) {
  const arena = await Arena.findById(arenaId).populate('scenarioId');
  if (!arena) {
    throw new Error('Arena not found');
  }

  const participants = arena.participants.filter((p: any) => !p.hasLeft);

  // ✅ 정확히 2명만 참가 가능
  if (participants.length !== 2) {
    throw new Error(`Defense Battle requires exactly 2 players. Current: ${participants.length}`);
  }

  // 랜덤하게 공격/방어 팀 배정
  const shuffled = participants.sort(() => Math.random() - 0.5);
  const attackMember = shuffled[0];
  const defenseMember = shuffled[1];

  // 시나리오 데이터에서 최대 체력 가져오기
  const scenario = arena.scenarioId as any;
  const defenderMaxHealth = scenario?.data?.serverHealth || 200;

  // Attack 팀 설정 (1명)
  await ArenaProgress.findOneAndUpdate(
    { arena: arenaId, user: attackMember.user },
    {
      teamName: 'ATTACK',
      teamRole: 'ATTACKER',
      score: 0,
      kills: 0,
      deaths: 0,
      health: 100,  // 🔥 추가: 초기 체력
      actions: []
    },
    { upsert: true, new: true }
  );

  // Defense 팀 설정 (1명)
  await ArenaProgress.findOneAndUpdate(
    { arena: arenaId, user: defenseMember.user },
    {
      teamName: 'DEFENSE',
      teamRole: 'DEFENDER',
      score: 0,
      kills: 0,
      deaths: 0,
      health: defenderMaxHealth,  // 🔥 추가: 초기 체력 (시나리오 설정값)
      actions: []
    },
    { upsert: true, new: true }
  );

  return {
    attackTeam: {
      members: [attackMember.user.toString()],
      count: 1
    },
    defenseTeam: {
      members: [defenseMember.user.toString()],
      count: 1
    }
  };
}