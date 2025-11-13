// src/pages/arena/ArenaResultPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Main from '../../components/main/Main';
import { getArenaResult } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaResultPage.scss';

type Participant = {
  userId: string;
  username: string;
  status: 'waiting' | 'vm_connected' | 'completed';
  completionTime: number | null;
  submittedAt: string | null;
  isCompleted: boolean;
  rank: number;
  score: number;
  stage: number;
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
  mode: string;
  maxParticipants: number;
  startTime: string;
  endTime: string;
  duration?: number;  // ✅ Optional - calculate from startTime/endTime if missing
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
  
  const checkedRef = useRef(false); // ✅ 중복 체크 방지

  useEffect(() => {
    if (!arenaId || checkedRef.current) return;

    const loadResults = async () => {
      try {
        checkedRef.current = true; // ✅ 중복 실행 방지
        setLoading(true);
        
        console.log('📊 [ArenaResultPage] Loading results for:', arenaId);
        
        const { user } = await getUserStatus();
        setCurrentUserId(user._id);

        const result = await getArenaResult(arenaId);
        
        console.log('📦 Arena result:', result);
        console.log('📊 Arena status:', result.status);
        
        // ✅ 게임이 끝나지 않았다면 플레이 페이지로 리다이렉션
        if (result.status !== 'ended') {
          console.log('⚠️ Game not ended, redirecting to play page...');
          navigate(`/arena/play/${arenaId}`, { replace: true });
          return;
        }

        console.log('✅ Game ended, displaying results');
        setArenaResult(result);

        // 결과 애니메이션 지연
        setTimeout(() => setShowResults(true), 500);

      } catch (err: any) {
        console.error('❌ Failed to load arena results:', err);
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
    if (participant.isCompleted) {
      return 'VICTORY';
    } else if (participant.stage > 0 || participant.score > 0) {
      return 'PARTICIPATED';
    } else {
      return 'DEFEATED';
    }
  };

  const getStatusClass = (participant: Participant): string => {
    if (participant.isCompleted) {
      return 'victory';
    } else if (participant.stage > 0 || participant.score > 0) {
      return 'connected';
    } else {
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
              <span className="ar-stat">{formatDuration(arenaResult.duration || Math.floor((new Date(arenaResult.endTime).getTime() - new Date(arenaResult.startTime).getTime()) / 1000))} MIN</span>
              <span className="ar-separator">|</span>
              <span className="ar-stat">{arenaResult.stats.totalParticipants}/{arenaResult.maxParticipants} PARTICIPANTS</span>
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

        {/* 순위 리스트 */}
        <div className={`ar-rankings ${showResults ? 'show' : ''}`}>
          {arenaResult.participants
            .sort((a, b) => a.rank - b.rank)
            .map((participant) => (
              <div
                key={participant.userId}
                className={`ar-rank-item rank-${participant.rank} ${
                  participant.userId === currentUserId ? 'is-me' : ''
                }`}
              >
                {/* 순위 번호 */}
                <div className="ar-rank-number">{participant.rank}</div>

                {/* 플레이어 정보 */}
                <div className="ar-rank-player-info">
                  <div className="ar-rank-player-name">
                    {participant.rank === 1 && <span className="ar-crown-icon">👑</span>}
                    {participant.username}
                    {participant.userId === currentUserId && (
                      <span className="ar-you-tag">YOU</span>
                    )}
                  </div>
                  <div className={`ar-rank-player-status ${getStatusClass(participant)}`}>
                    {getStatusText(participant)} • ⭐ {participant.score} pts • 
                    {participant.isCompleted ? ' ✅ Completed' : ` 📊 Stage ${participant.stage + 1}`}
                  </div>
                </div>

                {/* 완료 시간 */}
                {participant.completionTime !== null && (
                  <div className="ar-rank-completion-time">
                    {formatDuration(participant.completionTime)}
                  </div>
                )}
                {participant.completionTime === null && (
                  <div className="ar-rank-completion-time" style={{ opacity: 0.4 }}>
                    DNF
                  </div>
                )}
              </div>
            ))}
        </div>

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