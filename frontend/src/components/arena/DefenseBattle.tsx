// src/components/arena/DefenseBattle.tsx
import React, { useEffect, useState, useRef } from 'react';
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
  onCooldown?: boolean;
  cooldownRemaining?: number;
}

interface GameState {
  attacker: {
    score: number;
    health: number;
    maxHealth: number;
  };
  defender: {
    score: number;
    health: number;
    maxHealth: number;
  };
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
  const [availableActions, setAvailableActions] = useState<Action[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [myEnergy, setMyEnergy] = useState(100); // 에너지 시스템
  const [maxEnergy] = useState(100);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // 로그 추가 헬퍼
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setActionLog(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  // 게임 상태 및 액션 조회
  useEffect(() => {
    if (arena.status !== 'started' || !currentUserId || isInitialized) return;

    console.log('🎮 Initializing Defense Battle...');
    
    // 게임 상태 조회
    socket.emit('defenseBattle:get-state', { arenaId: arena._id });
    
    // 사용 가능한 액션 조회
    socket.emit('defenseBattle:get-actions', { arenaId: arena._id });
    
    setIsInitialized(true);
  }, [arena.status, arena._id, currentUserId, socket, isInitialized]);

  // 소켓 이벤트 리스너
  useEffect(() => {
    // 게임 상태 업데이트
    const handleStateData = (data: any) => {
      console.log('📊 State data received:', data);
      
      if (data.error) {
        console.error('State error:', data.error);
        return;
      }

      setMyTeam(data.myTeam);
      setMyRole(data.myRole);
      setMyScore(data.myScore || 0);
      setMyKills(data.myKills || 0);
      
      if (data.attacker && data.defender) {
        setGameState({
          attacker: data.attacker,
          defender: data.defender
        });
      }

      if (data.availableActions) {
        setAvailableActions(data.availableActions);
      }
    };

    // 액션 목록 업데이트
    const handleActionsData = (data: any) => {
      console.log('🎯 Actions data received:', data);
      setAvailableActions(data.actions || []);
      
      if (data.team) setMyTeam(data.team);
      if (data.role) setMyRole(data.role);
    };

    // 액션 실행 결과
    const handleResult = (data: any) => {
      console.log('💥 Action result:', data);
      
      addLog(`${data.actionName} executed! ${data.message}`);
      
      if (data.gameState) {
        setGameState(data.gameState);
      }
      
      if (data.userId === currentUserId) {
        setMyScore(data.totalScore || 0);
      }
    };

    // 참가자 업데이트
    const handleParticipantUpdate = (data: any) => {
      console.log('👤 Participant update:', data);
      
      if (data.userId === currentUserId && data.progress) {
        setMyScore(data.progress.score || 0);
        setMyKills(data.progress.kills || 0);
      }
    };

    // 액션 실패
    const handleActionFailed = (data: any) => {
      console.warn('❌ Action failed:', data.reason);
      addLog(`❌ ${data.reason}`);
    };

    // 에러
    const handleError = (data: any) => {
      console.error('⚠️ Error:', data.message);
      addLog(`⚠️ Error: ${data.message}`);
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
  }, [arena._id, currentUserId, socket]);

  // 액션 실행
  const handleExecuteAction = (actionName: string, actionCost: number) => {
    if (myEnergy < actionCost) {
      addLog(`❌ 에너지 부족! (필요: ${actionCost}, 현재: ${myEnergy})`);
      return;
    }

    console.log('🎯 Executing action:', actionName);
    socket.emit('defenseBattle:execute', { actionName });
    addLog(`⚡ ${actionName} 실행 중... (비용: ${actionCost})`);
    
    // 에너지 소모 (임시, 실제로는 서버에서 처리해야 함)
    setMyEnergy(prev => Math.max(0, prev - actionCost));
  };

  // 에너지 자동 회복 (시간당)
  useEffect(() => {
    const energyRecoveryInterval = setInterval(() => {
      setMyEnergy(prev => Math.min(maxEnergy, prev + 5)); // 초당 5 회복
    }, 1000);

    return () => clearInterval(energyRecoveryInterval);
  }, [maxEnergy]);

  // 게임 시작 전 대기
  if (arena.status === 'waiting') {
    const currentPlayers = participants.filter(p => !p.hasLeft).length;
    
    return (
      <div className="defense-battle-waiting">
        <div className="waiting-content">
          <div className="waiting-icon">⚔️</div>
          <h2>Defense Battle</h2>
          <p className="subtitle">1 vs 1 듀얼 매치</p>
          <div className="waiting-description">
            <p>게임 시작 시 자동으로 Attack/Defense 역할이 배정됩니다</p>
            <div className="duel-preview">
              <div className="player-slot">
                <div className="slot-icon">🗡️</div>
                <div className="slot-role">Attacker</div>
                <div className="slot-desc">서버를 공격하세요!</div>
              </div>
              <div className="vs-large">VS</div>
              <div className="player-slot">
                <div className="slot-icon">🛡️</div>
                <div className="slot-role">Defender</div>
                <div className="slot-desc">서버를 방어하세요!</div>
              </div>
            </div>
          </div>
          <div className="waiting-info">
            <div className="player-count">
              <span className="count-current">{currentPlayers}</span>
              <span className="count-divider">/</span>
              <span className="count-max">2</span>
              <span className="count-label">Players</span>
            </div>
            {currentPlayers === 1 && (
              <div className="waiting-message">
                상대를 기다리는 중...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 팀 배정 대기
  if (!myTeam || !myRole) {
    return (
      <div className="defense-battle-loading">
        <div className="loading-spinner"></div>
        <p>팀을 배정하는 중...</p>
      </div>
    );
  }

  // 체력바 렌더링
  const renderHealthBar = (current: number, max: number, label: string, teamType?: 'attack' | 'defense') => {
    const percentage = Math.max(0, Math.min(100, (current / max) * 100));
    
    return (
      <div className="health-bar-container">
        <div className="health-label">{label}</div>
        <div className={`health-bar ${teamType || ''}`}>
          <div 
            className="health-fill" 
            style={{ width: `${percentage}%` }}
          />
          <div className="health-percentage">{Math.round(percentage)}%</div>
        </div>
        <div className="health-text">{current} / {max} HP</div>
      </div>
    );
  };

  return (
    <div className="defense-battle-game">
      
      {/* 상단 정보 */}
      <div className="game-header">
        <div className="player-info">
          <div className={`team-badge ${myTeam.toLowerCase()}`}>
            {myTeam === 'ATTACK' ? '🗡️' : '🛡️'} Team {myTeam}
          </div>
          <div className="role-badge">{myRole}</div>
          <div className="stats-group">
            <div className="stat-item">
              <span className="stat-icon">⭐</span>
              <span className="stat-value">{myScore}</span>
              <span className="stat-label">Score</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">💀</span>
              <span className="stat-value">{myKills}</span>
              <span className="stat-label">Kills</span>
            </div>
          </div>
        </div>
        
        {/* 에너지 바 */}
        <div className="energy-container">
          <div className="energy-label">
            <span>⚡ Energy</span>
            <span className="energy-value">{myEnergy}/{maxEnergy}</span>
          </div>
          <div className="energy-bar">
            <div 
              className="energy-fill" 
              style={{ width: `${(myEnergy / maxEnergy) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 팀 상태 */}
      {gameState && gameState.attacker && gameState.defender && (
        <div className="teams-status">
          <div className={`team-panel attack ${myTeam === 'ATTACK' ? 'my-team' : ''}`}>
            <div className="team-header">
              <h3>🗡️ Attacker</h3>
              <div className="team-score">
                <span className="score-label">Score</span>
                <span className="score-value">{gameState.attacker.score ?? 0}</span>
              </div>
            </div>
            {renderHealthBar(
              gameState.attacker.health ?? 100,
              gameState.attacker.maxHealth ?? 100,
              'Health',
              'attack'
            )}
          </div>

          <div className="vs-divider">
            <div className="vs-circle">VS</div>
          </div>

          <div className={`team-panel defense ${myTeam === 'DEFENSE' ? 'my-team' : ''}`}>
            <div className="team-header">
              <h3>🛡️ Defender</h3>
              <div className="team-score">
                <span className="score-label">Score</span>
                <span className="score-value">{gameState.defender.score ?? 0}</span>
              </div>
            </div>
            {renderHealthBar(
              gameState.defender.health ?? 100,
              gameState.defender.maxHealth ?? 100,
              'Server Health',
              'defense'
            )}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="actions-section">
        <div className="section-header">
          <h4 className="section-title">
            {myRole === 'ATTACKER' ? '⚔️ Attack Actions' : '🛡️ Defense Actions'}
          </h4>
          <div className="section-hint">
            액션을 선택하여 실행하세요
          </div>
        </div>
        {availableActions.length === 0 ? (
          <div className="no-actions">
            <div className="no-actions-icon">🔄</div>
            <p>Loading actions...</p>
          </div>
        ) : (
          <div className="actions-grid">
            {availableActions.map((action) => {
              const canAfford = myEnergy >= action.cost;
              const isOnCooldown = action.onCooldown;
              const isDisabled = !canAfford || isOnCooldown;
              
              return (
                <button
                  key={action.name}
                  className={`action-button ${isOnCooldown ? 'on-cooldown' : ''} ${!canAfford ? 'no-energy' : ''}`}
                  onClick={() => handleExecuteAction(action.name, action.cost)}
                  disabled={isDisabled}
                >
                  <div className="action-header">
                    <div className="action-name">{action.name}</div>
                    <div className={`action-cost ${!canAfford ? 'insufficient' : ''}`}>
                      ⚡ {action.cost}
                    </div>
                  </div>
                  
                  <div className="action-effects">
                    {action.damage && (
                      <div className="effect-item damage">
                        <span className="effect-icon">⚔️</span>
                        <span className="effect-value">{action.damage}</span>
                        <span className="effect-label">Damage</span>
                      </div>
                    )}
                    {action.heal && (
                      <div className="effect-item heal">
                        <span className="effect-icon">❤️</span>
                        <span className="effect-value">{action.heal}</span>
                        <span className="effect-label">Heal</span>
                      </div>
                    )}
                    {action.shield && (
                      <div className="effect-item shield">
                        <span className="effect-icon">🛡️</span>
                        <span className="effect-value">{action.shield}</span>
                        <span className="effect-label">Shield</span>
                      </div>
                    )}
                  </div>
                  
                  {action.effect && (
                    <div className="action-description">{action.effect}</div>
                  )}
                  
                  {action.cooldown > 0 && !isOnCooldown && (
                    <div className="cooldown-info">
                      Cooldown: {action.cooldown}s
                    </div>
                  )}
                  
                  {isOnCooldown && action.cooldownRemaining && (
                    <div className="cooldown-overlay">
                      <div className="cooldown-timer">{action.cooldownRemaining}s</div>
                      <div className="cooldown-text">Cooldown</div>
                    </div>
                  )}
                  
                  {!canAfford && !isOnCooldown && (
                    <div className="energy-overlay">
                      <div className="overlay-text">⚡ Not Enough Energy</div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 액션 로그 */}
      <div className="action-log-section">
        <h4 className="section-title">📜 Battle Log</h4>
        <div className="action-log" ref={logContainerRef}>
          {actionLog.length === 0 ? (
            <div className="log-empty">
              <span className="log-empty-icon">💬</span>
              <span>No actions yet...</span>
            </div>
          ) : (
            actionLog.map((log, index) => (
              <div key={index} className="log-entry">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default DefenseBattle;