// src/components/arena/KingOfTheHill.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { FaBolt, FaCrown, FaClock, FaTrophy, FaMedal } from 'react-icons/fa';
import '../../assets/scss/arena/KingOfTheHill.scss';

type Participant = {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
  progress?: any;
};

interface KingOfTheHillProps {
  arena: { _id: string; mode: string; };
  socket: Socket;
  currentUserId: string | null;
  participants: Participant[];
}

interface AttackAction {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  successRate: number;
  effect: 'capture' | 'points';
  points?: number;
  cooldown: number;
}

interface DefenseAction {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  effect: 'defenseLevel' | 'block';
  defenseBonus?: number;
  blockChance?: number;
  cooldown: number;
}

interface ScenarioData {
  serverInfo: {
    name: string;
    description: string;
    os: string;
    initialVulnerabilities: string[];
  };
  attackActions: AttackAction[];
  defenseActions: DefenseAction[];
  scoring: {
    pointsPerSecond: number;
    firstCaptureBonus: number;
    fiveSecondBonus: number;
    oneMinuteBonus: number;
    captureBonus: number;
  };
  energySettings: {
    initial: number;
    regenRate: number;
    maxEnergy: number;
  };
}

interface PlayerState {
  userId: string;
  score: number;
  energy: number;
  isKing: boolean;
  kingTime: number;
  timesKing: number;
  attacksSucceeded: number;
  attacksFailed: number;
}

interface GameState {
  currentKing: string | null;
  kingCrownedAt: Date | null;
  defenseLevel: number;
  players: PlayerState[];
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
  kingTime: number;
  isCurrentKing: boolean;
}

const KingOfTheHill: React.FC<KingOfTheHillProps> = ({
  arena,
  socket,
  currentUserId,
  participants
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedTab, setSelectedTab] = useState<'attack' | 'defense'>('attack');
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [currentKingTime, setCurrentKingTime] = useState(0);
  const isInitializedRef = useRef(false);

  // 초기 데이터 로드
  useEffect(() => {
    if (isInitializedRef.current) return;

    const loadData = async () => {
      try {
        isInitializedRef.current = true;
        console.log('👑 [KingOfTheHill] Loading data for arena:', arena._id);
        
        socket.emit('koth:get-scenario', { arenaId: arena._id });
        socket.emit('koth:get-player-state', { arenaId: arena._id });
        socket.emit('koth:get-game-state', { arenaId: arena._id });
        socket.emit('koth:get-leaderboard', { arenaId: arena._id });

        setTimeout(() => {
          if (isLoading) {
            console.warn('⚠️ [KingOfTheHill] Loading timeout');
            setIsLoading(false);
          }
        }, 5000);

      } catch (error) {
        console.error('❌ Failed to load data:', error);
        setIsLoading(false);
      }
    };

    loadData();
  }, [arena._id, socket, isLoading]);

  // 소켓 이벤트 핸들러
  useEffect(() => {
    const handleScenarioData = (data: ScenarioData) => {
      console.log('📋 [KingOfTheHill] Scenario data received:', data);
      setScenario(data);
      setIsLoading(false);
    };

    const handlePlayerStateData = (data: PlayerState) => {
      console.log('📊 [KingOfTheHill] Player state received:', data);
      setPlayerState(data);
    };

    const handleGameStateData = (data: GameState) => {
      console.log('🎮 [KingOfTheHill] Game state received:', data);
      setGameState(data);
    };

    const handleGameStateUpdate = (data: GameState) => {
      console.log('🔄 [KingOfTheHill] Game state updated:', data);
      setGameState(data);
      
      const myState = data.players.find(p => p.userId === currentUserId);
      if (myState) {
        setPlayerState(myState);
      }
    };

    const handleLeaderboardData = (data: { leaderboard: LeaderboardEntry[] }) => {
      console.log('🏆 [KingOfTheHill] Leaderboard received:', data);
      setLeaderboard(data.leaderboard);
    };

    const handleActionResult = (data: any) => {
      console.log('✅ [KingOfTheHill] Action result:', data);
      
      if (data.actionType === 'attack') {
        if (data.captureSuccess) {
          showMessage(`👑 ${data.message}`, 'success');
        } else if (data.pointsGained > 0) {
          showMessage(`✅ ${data.message}`, 'success');
        } else {
          showMessage(`❌ ${data.message}`, 'error');
        }
      } else {
        showMessage(`🛡️ ${data.message}`, 'success');
      }

      // 플레이어 상태 갱신
      socket.emit('koth:get-player-state', { arenaId: arena._id });
    };

    const handleActionFailed = (data: any) => {
      console.log('❌ [KingOfTheHill] Action failed:', data);
      showMessage(`❌ ${data.reason}`, 'error');
    };

    const handleKingChanged = (data: any) => {
      console.log('👑 [KingOfTheHill] King changed:', data);
      
      if (data.newKing === currentUserId) {
        showMessage('🎉 You are now the King!', 'success');
      } else {
        const newKingName = leaderboard.find(e => e.userId === data.newKing)?.username || 'Someone';
        showMessage(`👑 ${newKingName} is now the King!`, 'info');
      }
    };

    const handleError = (data: any) => {
      console.error('❌ [KingOfTheHill] Error:', data);
      showMessage(`❌ ${data.message}`, 'error');
    };

    socket.on('koth:scenario-data', handleScenarioData);
    socket.on('koth:player-state-data', handlePlayerStateData);
    socket.on('koth:game-state-data', handleGameStateData);
    socket.on('koth:game-state-update', handleGameStateUpdate);
    socket.on('koth:leaderboard-data', handleLeaderboardData);
    socket.on('koth:action-result', handleActionResult);
    socket.on('koth:action-failed', handleActionFailed);
    socket.on('koth:king-changed', handleKingChanged);
    socket.on('koth:error', handleError);

    return () => {
      socket.off('koth:scenario-data', handleScenarioData);
      socket.off('koth:player-state-data', handlePlayerStateData);
      socket.off('koth:game-state-data', handleGameStateData);
      socket.off('koth:game-state-update', handleGameStateUpdate);
      socket.off('koth:leaderboard-data', handleLeaderboardData);
      socket.off('koth:action-result', handleActionResult);
      socket.off('koth:action-failed', handleActionFailed);
      socket.off('koth:king-changed', handleKingChanged);
      socket.off('koth:error', handleError);
    };
  }, [socket, currentUserId, arena._id, leaderboard]);

  // 리더보드 주기적 갱신
  useEffect(() => {
    const interval = setInterval(() => {
      socket.emit('koth:get-leaderboard', { arenaId: arena._id });
    }, 5000);

    return () => clearInterval(interval);
  }, [socket, arena._id]);

  // 왕 시간 실시간 업데이트
  useEffect(() => {
    if (!playerState?.isKing || !gameState?.kingCrownedAt) {
      setCurrentKingTime(0);
      return;
    }

    const interval = setInterval(() => {
      const crownedAt = new Date(gameState.kingCrownedAt!);
      const now = new Date();
      const seconds = Math.floor((now.getTime() - crownedAt.getTime()) / 1000);
      setCurrentKingTime(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [playerState?.isKing, gameState?.kingCrownedAt]);

  const showMessage = (msg: string, type: 'success' | 'error' | 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleAttack = (actionId: string) => {
    socket.emit('koth:attack', { actionId });
  };

  const handleDefend = (actionId: string) => {
    socket.emit('koth:defend', { actionId });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <FaTrophy className="rank-icon gold" />;
      case 2:
        return <FaMedal className="rank-icon silver" />;
      case 3:
        return <FaMedal className="rank-icon bronze" />;
      default:
        return <span className="rank-number">{rank}</span>;
    }
  };

  if (isLoading || !scenario || !playerState || !gameState) {
    return (
      <div className="koth-loading-container">
        <div className="loading-spinner"></div>
        <p>Loading King of the Hill...</p>
      </div>
    );
  }

  const totalKingTime = playerState.kingTime + currentKingTime;
  const energyPercentage = (playerState.energy / scenario.energySettings.maxEnergy) * 100;
  const isKing = playerState.isKing;
  const hasEnoughEnergy = (cost: number) => playerState.energy >= cost;

  return (
    <div className="king-of-the-hill-container">
      
      {/* 메시지 알림 */}
      {message && (
        <div className={`koth-message koth-message-${messageType}`}>
          {message}
        </div>
      )}

      {/* 헤더 */}
      <div className="koth-header">
        <div className="koth-header-left">
          <h2>👑 {scenario.serverInfo.name}</h2>
          <p className="server-description">{scenario.serverInfo.description}</p>
        </div>
        <div className="koth-header-right">
          <div className="server-stat">
            <span className="stat-label">OS:</span>
            <span className="stat-value">{scenario.serverInfo.os}</span>
          </div>
          <div className="server-stat">
            <span className="stat-label">Defense:</span>
            <span className="stat-value">🛡️ {gameState.defenseLevel}</span>
          </div>
        </div>
      </div>

      {/* 현재 왕 배너 */}
      {gameState.currentKing && (
        <div className={`current-king-banner ${gameState.currentKing === currentUserId ? 'is-you' : ''}`}>
          <FaCrown className="crown-icon" />
          <span className="king-text">
            {gameState.currentKing === currentUserId 
              ? 'YOU ARE THE KING!' 
              : `${leaderboard.find(e => e.userId === gameState.currentKing)?.username || 'Someone'} is the King`}
          </span>
          <FaCrown className="crown-icon" />
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <div className="koth-main-content">
        
        {/* 왼쪽: 플레이어 상태 */}
        <aside className="koth-sidebar koth-sidebar-left">
          <div className="sidebar-section">
            <h3 className="section-title">Your Status</h3>

            {/* 점수 */}
            <div className="status-card">
              <div className="status-icon">🏆</div>
              <div className="status-info">
                <div className="status-label">Score</div>
                <div className="status-value score-value">{playerState.score}</div>
              </div>
            </div>

            {/* 에너지 */}
            <div className="status-card">
              <div className="status-icon"><FaBolt /></div>
              <div className="status-info">
                <div className="status-label">
                  Energy
                  <span className="energy-regen">+{scenario.energySettings.regenRate}/s</span>
                </div>
                <div className="status-value">{playerState.energy} / {scenario.energySettings.maxEnergy}</div>
                <div className="energy-bar">
                  <div className="energy-fill" style={{ width: `${energyPercentage}%` }} />
                </div>
              </div>
            </div>

            {/* 왕 상태 */}
            <div className={`status-card ${isKing ? 'is-king' : ''}`}>
              <div className="status-icon"><FaCrown /></div>
              <div className="status-info">
                <div className="status-label">King Status</div>
                {isKing ? (
                  <div>
                    <div className="status-value king-active">👑 YOU ARE THE KING</div>
                    <div className="status-sublabel">Current: {formatTime(currentKingTime)}</div>
                  </div>
                ) : (
                  <div className="status-value king-inactive">Not King</div>
                )}
              </div>
            </div>

            {/* 왕좌 시간 */}
            <div className="status-card">
              <div className="status-icon">⏱️</div>
              <div className="status-info">
                <div className="status-label">Total King Time</div>
                <div className="status-value">{formatTime(totalKingTime)}</div>
                <div className="status-sublabel">Crowned {playerState.timesKing} times</div>
              </div>
            </div>

            {/* 전투 통계 */}
            <div className="status-card">
              <div className="status-icon"></div>
              <div className="status-info">
                <div className="status-label">Attack Stats</div>
                <div className="stat-row">
                  <span className="stat-success">{playerState.attacksSucceeded} Success</span>
                  <span className="stat-separator">/</span>
                  <span className="stat-failed">{playerState.attacksFailed} Failed</span>
                </div>
              </div>
            </div>
          </div>

          {/* 취약점 */}
          <div className="sidebar-section">
            <h3 className="section-title">🔓 Vulnerabilities</h3>
            <div className="vulnerability-list">
              {scenario.serverInfo.initialVulnerabilities.map((vuln, index) => (
                <div key={index} className="vulnerability-item">
                  {vuln}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* 중앙: 액션 */}
        <main className="koth-actions-area">
          {/* 탭 헤더 */}
          <div className="actions-tabs">
            <button
              className={`tab-button ${selectedTab === 'attack' ? 'active' : ''}`}
              onClick={() => setSelectedTab('attack')}
            >
              Attack Actions
            </button>
            <button
              className={`tab-button ${selectedTab === 'defense' ? 'active' : ''} ${!isKing ? 'disabled' : ''}`}
              onClick={() => isKing && setSelectedTab('defense')}
              disabled={!isKing}
            >
              Defense Actions
              {!isKing && <span className="lock-badge">🔒</span>}
            </button>
          </div>

          {/* 액션 그리드 */}
          <div className="actions-grid">
            {selectedTab === 'attack' && scenario.attackActions.map((action) => {
              const canUse = hasEnoughEnergy(action.energyCost);
              
              return (
                <div
                  key={action.id}
                  className={`action-card attack ${!canUse ? 'disabled' : ''}`}
                  onClick={() => canUse && handleAttack(action.id)}
                >
                  <div className="action-header">
                    <h4 className="action-name">
                      {action.effect === 'capture' ? '👑' : '💯'} {action.name}
                    </h4>
                    <div className="success-rate">{action.successRate}%</div>
                  </div>

                  <p className="action-description">{action.description}</p>

                  <div className="action-footer">
                    <div className="action-stats">
                      <span className="stat"><FaBolt /> {action.energyCost}</span>
                      <span className="stat"><FaClock /> {action.cooldown}s</span>
                      {action.effect === 'points' && action.points && (
                        <span className="stat">+{action.points} pts</span>
                      )}
                    </div>
                    <div className="action-effect">
                      {action.effect === 'capture' ? '🎯 Capture' : '💰 Points'}
                    </div>
                  </div>

                  {!canUse && (
                    <div className="disabled-overlay">
                      Not Enough Energy
                    </div>
                  )}
                </div>
              );
            })}

            {selectedTab === 'defense' && (
              !isKing ? (
                <div className="no-defense-message">
                  <div className="lock-icon">🔒</div>
                  <h3>King Only</h3>
                  <p>You must be the current king to use defense actions.</p>
                </div>
              ) : (
                scenario.defenseActions.map((action) => {
                  const canUse = hasEnoughEnergy(action.energyCost);
                  
                  return (
                    <div
                      key={action.id}
                      className={`action-card defense ${!canUse ? 'disabled' : ''}`}
                      onClick={() => canUse && handleDefend(action.id)}
                    >
                      <div className="action-header">
                        <h4 className="action-name">🛡️ {action.name}</h4>
                        <div className="effect-badge">
                          {action.effect === 'defenseLevel' ? '📈' : '🚫'}
                        </div>
                      </div>

                      <p className="action-description">{action.description}</p>

                      <div className="action-footer">
                        <div className="action-stats">
                          <span className="stat"><FaBolt /> {action.energyCost}</span>
                          <span className="stat"><FaClock /> {action.cooldown}s</span>
                        </div>
                        <div className="action-effect">
                          {action.effect === 'defenseLevel' && action.defenseBonus && (
                            <span>+{action.defenseBonus} Defense</span>
                          )}
                          {action.effect === 'block' && action.blockChance && (
                            <span>+{action.blockChance}% Block</span>
                          )}
                        </div>
                      </div>

                      {!canUse && (
                        <div className="disabled-overlay">
                          Not Enough Energy
                        </div>
                      )}
                    </div>
                  );
                })
              )
            )}
          </div>
        </main>

        {/* 오른쪽: 리더보드 */}
        <aside className="koth-sidebar koth-sidebar-right">
          <div className="sidebar-section">
            <h3 className="section-title"><FaTrophy /> Leaderboard</h3>

            <div className="leaderboard-list">
              {leaderboard.length === 0 ? (
                <div className="no-players">
                  <p>No players yet</p>
                </div>
              ) : (
                leaderboard.map((entry) => (
                  <div
                    key={entry.userId}
                    className={`leaderboard-entry ${
                      entry.userId === currentUserId ? 'is-you' : ''
                    } ${entry.isCurrentKing ? 'is-king' : ''}`}
                  >
                    <div className="entry-rank">{getRankIcon(entry.rank)}</div>

                    <div className="entry-info">
                      <div className="entry-name">
                        {entry.isCurrentKing && <FaCrown className="king-icon" />}
                        {entry.username}
                        {entry.userId === currentUserId && (
                          <span className="you-badge">YOU</span>
                        )}
                      </div>
                      <div className="entry-stats">
                        <span>🏆 {entry.score}</span>
                        <span>⏱️ {formatTime(entry.kingTime)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
};

export default KingOfTheHill;