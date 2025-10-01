// src/pages/arena/ArenaResultPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import Main from '../../components/main/Main';
import { getArenaResult } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaResultPage.scss';

type Participant = {
  userId: string;
  username: string;
  status: 'waiting' | 'vpn_connecting' | 'vm_connected' | 'flag_submitted' | 'completed';
  completionTime: number | null;
  submittedAt: string | null;
  isCompleted: boolean;
  rank: number;
};

type Winner = {
  userId: string;
  username: string;
  solvedAt: string | null;
} | null;

type ArenaResult = {
  _id: string;
  name: string;
  host: string;
  hostName: string;
  status: 'ended';
  category: string;
  startTime: string;
  endTime: string;
  duration: number;
  participants: Participant[];
  winner: Winner;
  firstSolvedAt: string | null;
  arenaExp: number;
  stats: {
    totalParticipants: number;
    completedCount: number;
    successRate: number;
  };
  settings: {
    endOnFirstSolve: boolean;
    graceMs: number;
    hardTimeLimitMs: number;
  };
};

const ArenaResultPage: React.FC = () => {
  const { id: arenaId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [arenaResult, setArenaResult] = useState<ArenaResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!arenaId) return;

    const loadResults = async () => {
      try {
        setLoading(true);
        const { user } = await getUserStatus();
        setCurrentUserId(user._id);

        const result = await getArenaResult(arenaId);
        
        // 게임이 끝나지 않았다면 플레이 페이지로 리디렉션
        if (result.status !== 'ended') {
          navigate(`/arena/play/${arenaId}`);
          return;
        }

        setArenaResult(result);

        // 결과 애니메이션 지연
        setTimeout(() => setShowResults(true), 500);

      } catch (err: any) {
        console.error('Failed to load arena results:', err);
        setError(err?.message || 'Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [arenaId, navigate]);

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusText = (participant: Participant): string => {
    switch (participant.status) {
      case 'flag_submitted':
      case 'completed':
        return 'VICTORY';
      case 'vm_connected':
        return 'CONNECTED';
      case 'vpn_connecting':
        return 'CONNECTING';
      case 'waiting':
      default:
        return 'DEFEATED';
    }
  };

  const getStatusClass = (participant: Participant): string => {
    switch (participant.status) {
      case 'flag_submitted':
      case 'completed':
        return 'victory';
      case 'vm_connected':
        return 'connected';
      case 'vpn_connecting':
        return 'connecting';
      default:
        return 'defeated';
    }
  };

  if (loading) {
    return (
      <Main>
        <div className="ar-container">
          <div className="ar-loading">
            <div className="ar-spinner"></div>
            <p>Processing Results...</p>
          </div>
        </div>
      </Main>
    );
  }

  if (error || !arenaResult) {
    return (
      <Main>
        <div className="ar-container">
          <div className="ar-error">
            <h2>CONNECTION FAILED</h2>
            <p>{error || 'Unable to retrieve arena results'}</p>
            <button className="ar-button" onClick={() => navigate('/arena')}>
              RETURN TO BASE
            </button>
          </div>
        </div>
      </Main>
    );
  }

  const myResult = arenaResult.participants.find(p => p.userId === currentUserId);

  // 포디움 배치를 위한 순위별 참가자
  const first = arenaResult.participants.find(p => p.rank === 1);
  const second = arenaResult.participants.find(p => p.rank === 2);
  const third = arenaResult.participants.find(p => p.rank === 3);
  const fourth = arenaResult.participants.find(p => p.rank === 4);

  return (
    <Main>
      <div className="ar-container">
        <div className="ar-grid-background"></div>
        <div className="ar-hud-corners">
          <div className="ar-corner top-left"></div>
          <div className="ar-corner top-right"></div>
          <div className="ar-corner bottom-left"></div>
          <div className="ar-corner bottom-right"></div>
        </div>

        {/* 게임 오버 헤더 */}
        <header className="ar-header">
          <div className="ar-game-over">
            <h1 className="ar-game-over-text">MISSION COMPLETE</h1>
            <div className="ar-arena-name">{arenaResult.name}</div>
            <div className="ar-mission-stats">
              <span className="ar-stat">{formatDuration(arenaResult.duration)}</span>
              <span className="ar-separator">|</span>
              <span className="ar-stat">{arenaResult.stats.totalParticipants}/4 AGENTS</span>
              <span className="ar-separator">|</span>
              <span className="ar-stat">{arenaResult.stats.successRate}% SUCCESS</span>
            </div>
          </div>
        </header>

        {/* 승리자 공지 */}
        {arenaResult.winner && (
          <div className={`ar-victory-announcement ${showResults ? 'show' : ''}`}>
            <div className="ar-victory-content">
              <div className="ar-victory-crown">👑</div>
              <div className="ar-victory-text">
                <div className="ar-victory-label">MISSION LEADER</div>
                <div className="ar-victory-name">
                  {arenaResult.winner.username}
                </div>
              </div>
              <div className="ar-victory-time">
                {arenaResult.winner.solvedAt && formatDuration(
                  Math.floor((new Date(arenaResult.winner.solvedAt).getTime() - 
                            new Date(arenaResult.startTime).getTime()) / 1000)
                )}
              </div>
            </div>
          </div>
        )}

        {/* 포디움 스타일 순위 */}
        <div className={`ar-podium ${showResults ? 'show' : ''}`}>
          {/* 2등 (왼쪽) */}
          {second && (
            <div className="ar-podium-position second" style={{ animationDelay: '0.5s' }}>
              <div className="ar-podium-player">
                <div className="ar-rank-badge silver">2</div>
                <div className="ar-player-info">
                  <div className="ar-player-name">
                    {second.username}
                  </div>
                  <div className={`ar-player-status ${getStatusClass(second)}`}>
                    {getStatusText(second)}
                  </div>
                  {second.completionTime && (
                    <div className="ar-completion-time">
                      {formatDuration(second.completionTime)}
                    </div>
                  )}
                </div>
              </div>
              <div className="ar-podium-stand second-place"></div>
            </div>
          )}

          {/* 1등 (가운데) */}
          {first && (
            <div className="ar-podium-position first" style={{ animationDelay: '0.8s' }}>
              <div className="ar-podium-player">
                <div className="ar-rank-badge gold">1</div>
                <div className="ar-player-info">
                  <div className="ar-player-name">
                    {first.username}
                    {first.userId === currentUserId && (
                      <span className="ar-you-tag">YOU</span>
                    )}
                  </div>
                  <div className={`ar-player-status ${getStatusClass(first)}`}>
                    {getStatusText(first)}
                  </div>
                  {first.completionTime && (
                    <div className="ar-completion-time">
                      {formatDuration(first.completionTime)}
                    </div>
                  )}
                </div>
              </div>
              <div className="ar-podium-stand first-place"></div>
            </div>
          )}

          {/* 3등 (오른쪽) */}
          {third && (
            <div className="ar-podium-position third" style={{ animationDelay: '1.1s' }}>
              <div className="ar-podium-player">
                <div className="ar-rank-badge bronze">3</div>
                <div className="ar-player-info">
                  <div className="ar-player-name">
                    {third.username}
                  </div>
                  <div className={`ar-player-status ${getStatusClass(third)}`}>
                    {getStatusText(third)}
                  </div>
                  {third.completionTime && (
                    <div className="ar-completion-time">
                      {formatDuration(third.completionTime)}
                    </div>
                  )}
                </div>
              </div>
              <div className="ar-podium-stand third-place"></div>
            </div>
          )}
        </div>

        {/* 4등이 있다면 별도 표시 */}
        {fourth && (
          <div className={`ar-fourth-place ${showResults ? 'show' : ''}`} style={{ animationDelay: '1.4s' }}>
            <div className="ar-fourth-player">
              <div className="ar-rank-badge fourth">4</div>
              <div className="ar-player-info">
                <div className="ar-player-name">
                  {fourth.username}
                  {fourth.userId === currentUserId && (
                    <span className="ar-you-tag">YOU</span>
                  )}
                </div>
                <div className={`ar-player-status ${getStatusClass(fourth)}`}>
                  {getStatusText(fourth)}
                </div>
                {fourth.completionTime && (
                  <div className="ar-completion-time">
                    {formatDuration(fourth.completionTime)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 내 결과 하이라이트 (포디움에 없을 경우만) */}
        {myResult && myResult.rank && myResult.rank > 3 && (
          <div className={`ar-my-result ${showResults ? 'show' : ''}`}>
            <div className="ar-my-result-panel">
              <div className="ar-my-result-header">YOUR PERFORMANCE</div>
              <div className="ar-my-result-content">
                <div className="ar-my-rank">#{myResult.rank}</div>
                <div className="ar-my-status">
                  <span className={`ar-status-badge ${getStatusClass(myResult)}`}>
                    {getStatusText(myResult)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 액션 버튼들 */}
        <div className={`ar-actions ${showResults ? 'show' : ''}`}>
          <button 
            className="ar-button secondary" 
            onClick={() => navigate('/arena')}
          >
            RETURN TO LOBBY
          </button>
          <button 
            className="ar-button primary" 
            onClick={() => navigate('/arena/create')}
          >
            START NEW MISSION
          </button>
        </div>
      </div>
    </Main>
  );
};

export default ArenaResultPage;