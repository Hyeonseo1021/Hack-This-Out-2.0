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

  // 4. 쿨다운 체크 (간단 버전 - 마지막 액션 시간 기반)
  const lastAction = userProgress.actions[userProgress.actions.length - 1];
  if (lastAction && lastAction.actionName === actionName) {
    const timeSinceLastAction = Date.now() - new Date(lastAction.timestamp).getTime();
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

  const opposingTeamName = userTeam === 'ATTACK' ? 'DEFENSE' : 'ATTACK';

  if (actionType === 'attack') {
    damage = actionData.damage || 0;
    scoreGain = Math.floor(damage / 10);
    
    // 상대팀 전체에 데미지 적용 (실제로는 공유 체력)
    // 여기서는 점수로만 처리
  } else {
    heal = actionData.heal || 0;
    shield = actionData.shield || 0;
    scoreGain = Math.floor((heal + shield) / 5);
  }

  // 6. 게임 상태 가져오기
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
    
    // 승리팀의 첫 번째 유저를 대표 승자로
    if (winner === 'ATTACK' && attackTeamProgress.length > 0) {
      winnerUserId = attackTeamProgress[0].user.toString();
    } else if (winner === 'DEFENSE' && defenseTeamProgress.length > 0) {
      winnerUserId = defenseTeamProgress[0].user.toString();
    }
  }

  // 8. 게임 상태 반환
  const gameState = {
    attackTeam: {
      score: attackScore,
      members: attackTeamProgress.length
    },
    defenseTeam: {
      score: defenseScore,
      members: defenseTeamProgress.length
    }
  };

  return {
    success: true,
    message: `${actionName} executed successfully!`,
    scoreGain,
    damage,
    heal,
    shield,
    actionType,
    gameState,
    gameOver,
    winner,
    winnerUserId
  };
}

/**
 * 게임 종료 조건 체크
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
 */
export async function initializeDefenseBattleTeams(arenaId: string) {
  const arena = await Arena.findById(arenaId);
  if (!arena) {
    throw new Error('Arena not found');
  }

  const participants = arena.participants.filter((p: any) => !p.hasLeft);
  const shuffled = participants.sort(() => Math.random() - 0.5);
  
  const midPoint = Math.ceil(shuffled.length / 2);
  const attackMembers = shuffled.slice(0, midPoint);
  const defenseMembers = shuffled.slice(midPoint);

  // Attack 팀 설정
  for (const member of attackMembers) {
    await ArenaProgress.findOneAndUpdate(
      { arena: arenaId, user: member.user },
      {
        teamName: 'ATTACK',
        teamRole: 'ATTACKER',
        score: 0,
        kills: 0,
        deaths: 0,
        actions: []
      },
      { upsert: true, new: true }
    );
  }

  // Defense 팀 설정
  for (const member of defenseMembers) {
    await ArenaProgress.findOneAndUpdate(
      { arena: arenaId, user: member.user },
      {
        teamName: 'DEFENSE',
        teamRole: 'DEFENDER',
        score: 0,
        kills: 0,
        deaths: 0,
        actions: []
      },
      { upsert: true, new: true }
    );
  }

  return {
    attackTeam: {
      members: attackMembers.map((m: any) => m.user.toString()),
      count: attackMembers.length
    },
    defenseTeam: {
      members: defenseMembers.map((m: any) => m.user.toString()),
      count: defenseMembers.length
    }
  };
}