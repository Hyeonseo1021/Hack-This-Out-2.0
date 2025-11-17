// src/components/arena/DefenseBattle.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import '../../assets/scss/arena/DefenseBattle.scss';

interface Participant {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
  progress?: {
    score: number;
    team?: string;
    role?: string;
    kills?: number;
  };
}

interface Arena {
  _id: string;
  name: string;
  mode: string;
  status: string;
  host: string;
  startTime: string | null;
  endTime: string | null;
  participants: Participant[];
}

interface DefenseBattleProps {
  arena: Arena;
  socket: Socket;
  currentUserId: string | null;
  participants: Participant[];
}

interface Action {
  name: string;
  damage?: number;
  heal?: number;
  shield?: number;
  cost: number;
  cooldown: number;
  effect?: string;
}

interface TeamState {
  score: number;
  health: number;
  maxHealth: number;
  members: number;
}

interface GameState {
  attackTeam: TeamState;
  defenseTeam: TeamState;
}

const DefenseBattle: React.FC<DefenseBattleProps> = ({ 
  arena, 
  socket, 
  currentUserId,
  participants 
}) => {
  const [myTeam, setMyTeam] = useState<'ATTACK' | 'DEFENSE' | null>(null);
  const [myRole, setMyRole] = useState<'ATTACKER' | 'DEFENDER' | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [myKills, setMyKills] = useState(0);
  const [myEnergy, setMyEnergy] = useState(100);
  const maxEnergy = 100;
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [availableActions, setAvailableActions] = useState<Action[]>([]);
  const [actionLog, setActionLog] = useState<string[]>([]);
  
  const [cooldowns, setCooldowns] = useState<Map<string, number>>(new Map());
  const cooldownTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  const [isInitialized, setIsInitialized] = useState(false);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setActionLog(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 30));
  }, []);

  const startCooldown = useCallback((actionName: string, seconds: number) => {
    const existingTimer = cooldownTimers.current.get(actionName);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    setCooldowns(prev => {
      const next = new Map(prev);
      next.set(actionName, seconds);
      return next;
    });

    const timer = setInterval(() => {
      setCooldowns(prev => {
        const next = new Map(prev);
        const remaining = next.get(actionName);
        
        if (!remaining || remaining <= 1) {
          next.delete(actionName);
          const t = cooldownTimers.current.get(actionName);
          if (t) {
            clearInterval(t);
            cooldownTimers.current.delete(actionName);
          }
        } else {
          next.set(actionName, remaining - 1);
        }
        
        return next;
      });
    }, 1000);

    cooldownTimers.current.set(actionName, timer);
  }, []);

  useEffect(() => {
    if (arena.status !== 'started' || !currentUserId || isInitialized) return;
    socket.emit('defenseBattle:get-state', { arenaId: arena._id });
    socket.emit('defenseBattle:get-actions', { arenaId: arena._id });
    setIsInitialized(true);
  }, [arena.status, arena._id, currentUserId, socket, isInitialized]);

  useEffect(() => {
    const handleStateData = (data: any) => {
      if (data.error) return;

      setMyTeam(data.myTeam);
      setMyRole(data.myRole);
      setMyScore(data.myScore || 0);
      setMyKills(data.myKills || 0);

      if (data.attacker && data.defender) {
        setGameState({
          attackTeam: {
            score: data.attacker.score || 0,
            health: data.attacker.health || 100,
            maxHealth: data.attacker.maxHealth || 100,
            members: data.attacker.members || 0
          },
          defenseTeam: {
            score: data.defender.score || 0,
            health: data.defender.health || 200,
            maxHealth: data.defender.maxHealth || 200,
            members: data.defender.members || 0
          }
        });
      }

      if (data.availableActions) {
        setAvailableActions(data.availableActions);
      }
    };

    const handleActionsData = (data: any) => {
      setAvailableActions(data.actions || []);
      if (data.team) setMyTeam(data.team);
      if (data.role) setMyRole(data.role);
    };

    const handleResult = (data: any) => {
      const damage = data.damage || 0;
      const heal = data.heal || 0;
      
      let logMsg = `${data.actionName}`;
      if (damage > 0) logMsg += ` 💥 ${damage}`;
      if (heal > 0) logMsg += ` ❤️ ${heal}`;
      logMsg += ` (+${data.scoreGain || 0}점)`;
      
      addLog(logMsg);

      if (data.gameState) {
        const gs = data.gameState;
        
        setGameState({
          attackTeam: {
            score: gs.attackTeam?.score || 0,
            health: gs.attackTeam?.health || 100,
            maxHealth: gs.attackTeam?.maxHealth || 100,
            members: gs.attackTeam?.members || 0
          },
          defenseTeam: {
            score: gs.defenseTeam?.score || 0,
            health: gs.defenseTeam?.health || 200,
            maxHealth: gs.defenseTeam?.maxHealth || 200,
            members: gs.defenseTeam?.members || 0
          }
        });
      }

      if (data.userId === currentUserId) {
        setMyScore(data.totalScore || 0);
      }

      const action = availableActions.find(a => a.name === data.actionName);
      if (action && action.cooldown > 0) {
        startCooldown(data.actionName, action.cooldown);
      }
    };

    const handleParticipantUpdate = (data: any) => {
      if (data.userId === currentUserId && data.progress) {
        setMyScore(data.progress.score || 0);
        setMyKills(data.progress.kills || 0);
      }
    };

    const handleActionFailed = (data: any) => {
      addLog(`❌ ${data.reason}`);
    };

    const handleError = (data: any) => {
      addLog(`⚠️ ${data.message}`);
    };

    socket.on('defenseBattle:state-data', handleStateData);
    socket.on('defenseBattle:actions-data', handleActionsData);
    socket.on('defenseBattle:result', handleResult);
    socket.on('participant:update', handleParticipantUpdate);
    socket.on('arena:action-failed', handleActionFailed);
    socket.on('defenseBattle:error', handleError);

    return () => {
      socket.off('defenseBattle:state-data', handleStateData);
      socket.off('defenseBattle:actions-data', handleActionsData);
      socket.off('defenseBattle:result', handleResult);
      socket.off('participant:update', handleParticipantUpdate);
      socket.off('arena:action-failed', handleActionFailed);
      socket.off('defenseBattle:error', handleError);
    };
  }, [arena._id, currentUserId, socket, addLog, startCooldown, availableActions]);

  useEffect(() => {
    return () => {
      cooldownTimers.current.forEach(timer => clearInterval(timer));
      cooldownTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setMyEnergy(prev => Math.min(maxEnergy, prev + 5));
    }, 1000);
    return () => clearInterval(timer);
  }, [maxEnergy]);

  const handleExecuteAction = (actionName: string, cost: number) => {
    if (cooldowns.has(actionName)) {
      addLog(`❌ ${actionName} 쿨다운 중 (${cooldowns.get(actionName)}초)`);
      return;
    }

    if (myEnergy < cost) {
      addLog(`❌ 에너지 부족 (필요: ${cost})`);
      return;
    }

    socket.emit('defenseBattle:execute', { actionName });
    addLog(`⚡ ${actionName} 사용`);
    
    setMyEnergy(prev => Math.max(0, prev - cost));
  };

  if (arena.status === 'waiting') {
    const currentPlayers = participants.filter(p => !p.hasLeft).length;
    
    return (
      <div className="battle-waiting">
        <div className="waiting-card">
          <div className="waiting-icon">⚔️</div>
          <h2>Defense Battle</h2>
          <div className="player-count">
            <span className="current">{currentPlayers}</span>
            <span className="divider">/</span>
            <span className="max">2</span>
          </div>
          {currentPlayers === 1 && (
            <p className="waiting-text">상대를 기다리는 중...</p>
          )}
        </div>
      </div>
    );
  }

  if (!myTeam || !myRole) {
    return (
      <div className="battle-loading">
        <div className="spinner"></div>
        <p>팀 배정 중...</p>
      </div>
    );
  }

  const myTeamState = myTeam === 'ATTACK' ? gameState?.attackTeam : gameState?.defenseTeam;
  const enemyTeamState = myTeam === 'ATTACK' ? gameState?.defenseTeam : gameState?.attackTeam;

  return (
    <div className="defense-battle">
      
      {/* 상단: 내 정보 */}
      <div className="battle-header">
        <div className="my-info">
          <div className={`team-tag ${myTeam.toLowerCase()}`}>
            {myTeam === 'ATTACK' ? '⚔️ ATTACK' : '🛡️ DEFENSE'}
          </div>
          <div className="stats">
            <span className="stat">⭐ {myScore}</span>
            <span className="stat">💀 {myKills}</span>
          </div>
        </div>
        
        <div className="energy">
          <div className="energy-label">
            <span>⚡ ENERGY</span>
            <span className="value">{myEnergy}/{maxEnergy}</span>
          </div>
          <div className="energy-bar">
            <div className="fill" style={{ width: `${(myEnergy / maxEnergy) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* 중앙: 게임 상태 */}
      <div className="battle-field">
        
        {/* 왼쪽: 내 팀 */}
        <div className={`team-status my ${myTeam.toLowerCase()}`}>
          <div className="team-name">
            {myTeam === 'ATTACK' ? '⚔️ ATTACKER' : '🛡️ DEFENSER'}
          </div>
          <div className="team-score">{myTeamState?.score || 0}</div>
          <div className="hp-bar">
            <div 
              className="hp-fill" 
              style={{ width: `${((myTeamState?.health || 0) / (myTeamState?.maxHealth || 1)) * 100}%` }}
            />
          </div>
          <div className="hp-text">
            {myTeamState?.health || 0} / {myTeamState?.maxHealth || 0} HP
          </div>
        </div>

        {/* 중앙: VS */}
        <div className="vs">VS</div>

        {/* 오른쪽: 적 팀 */}
        <div className={`team-status enemy ${myTeam === 'ATTACK' ? 'defense' : 'attack'}`}>
          <div className="team-name">
            {myTeam === 'ATTACK' ? '🛡️ DEFENSER' : '⚔️ ATTACKER'}
          </div>
          <div className="team-score">{enemyTeamState?.score || 0}</div>
          <div className="hp-bar">
            <div 
              className="hp-fill" 
              style={{ width: `${((enemyTeamState?.health || 0) / (enemyTeamState?.maxHealth || 1)) * 100}%` }}
            />
          </div>
          <div className="hp-text">
            {enemyTeamState?.health || 0} / {enemyTeamState?.maxHealth || 0} HP
          </div>
        </div>

      </div>

      {/* 하단: 액션 + 로그 */}
      <div className="battle-controls">
        
        {/* 왼쪽: 액션 버튼 */}
        <div className="actions">
          <h3 className="section-title">
            {myRole === 'ATTACKER' ? '⚔️ 공격 액션' : '🛡️ 방어 액션'}
          </h3>
          
          {availableActions.length === 0 ? (
            <div className="no-actions">Loading...</div>
          ) : (
            <div className="action-grid">
              {availableActions.map((action) => {
                const canAfford = myEnergy >= action.cost;
                const cooldownRemaining = cooldowns.get(action.name) || 0;
                const isOnCooldown = cooldownRemaining > 0;
                const isDisabled = !canAfford || isOnCooldown;
                
                return (
                  <button
                    key={action.name}
                    className={`action-btn ${isOnCooldown ? 'cooldown' : ''} ${!canAfford ? 'no-energy' : ''}`}
                    onClick={() => handleExecuteAction(action.name, action.cost)}
                    disabled={isDisabled}
                  >
                    <div className="action-top">
                      <span className="action-name">{action.name}</span>
                      <span className="action-cost">⚡{action.cost}</span>
                    </div>
                    
                    <div className="action-effects">
                      {action.damage && <span className="dmg">💥 {action.damage}</span>}
                      {action.heal && <span className="heal">❤️ {action.heal}</span>}
                      {action.shield && <span className="shield">🛡️ {action.shield}</span>}
                    </div>
                    
                    {isOnCooldown && (
                      <div className="cooldown-overlay">
                        <div className="cooldown-time">{cooldownRemaining}s</div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 오른쪽: 배틀 로그 */}
        <div className="battle-log">
          <h3 className="section-title">📜 배틀 로그</h3>
          <div className="log-content">
            {actionLog.length === 0 ? (
              <div className="log-empty">액션 로그가 표시됩니다</div>
            ) : (
              actionLog.map((log, index) => (
                <div key={index} className="log-entry">{log}</div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default DefenseBattle;