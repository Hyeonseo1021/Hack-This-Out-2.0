// src/pages/arena/ArenaResultPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Main from '../../components/main/Main';
import { getArenaResult } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaResultPage.scss';

// ✅ 게임 모드별 Participant 타입 정의
type BaseParticipant = {
  userId: string;
  username: string;
  status: 'waiting' | 'vm_connected' | 'completed';
  completionTime: number | null;
  submittedAt: string | null;
  isCompleted: boolean;
  rank: number;
  score: number;
  expEarned: number;  // ✨ 경험치 추가
  coinsEarned: number; // 💰 코인 추가
};

// Terminal Race용
type TerminalRaceParticipant = BaseParticipant & {
  stage: number;
  flags?: string[];
};

// King of the Hill용
type KingOfTheHillParticipant = BaseParticipant & {
  kingTime?: number;
  timesKing?: number;
  attacksSucceeded?: number;
  attacksFailed?: number;
};

// Forensics Rush용
type ForensicsRushParticipant = BaseParticipant & {
  questionsAnswered?: number;
  questionsCorrect?: number;
  totalAttempts?: number;
  penalties?: number;
  totalQuestions?: number;
};

type Participant =
  | TerminalRaceParticipant
  | KingOfTheHillParticipant
  | ForensicsRushParticipant;

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
  mode: 'terminal-race' | 'defense-battle' | 'king-of-the-hill' | 'forensics-rush';
  maxParticipants: number;
  startTime: string;
  endTime: string;
  duration?: number;
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
  };
};

const ArenaResultPage: React.FC = () => {
  const { id: arenaId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('arena');

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [arenaResult, setArenaResult] = useState<ArenaResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const checkedRef = useRef(false);

  useEffect(() => {
    if (!arenaId || checkedRef.current) return;

    const loadResults = async () => {
      try {
        checkedRef.current = true;
        setLoading(true);

        console.log('[ArenaResultPage] Loading results for:', arenaId);

        const { user } = await getUserStatus();
        setCurrentUserId(user._id);

        const result = await getArenaResult(arenaId);

        console.log('Arena result:', result);
        console.log('Arena status:', result.status);
        console.log('Game mode:', result.mode);

        if (result.status !== 'ended') {
          console.log('Game not ended, redirecting to play page...');
          navigate(`/arena/play/${arenaId}`, { replace: true });
          return;
        }

        console.log('Game ended, displaying results');
        setArenaResult(result);

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
    const secs = seconds % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  // ✅ 게임 모드별 상태 텍스트
  const getStatusText = (participant: Participant, mode: string): string => {
    if (participant.isCompleted) {
      return 'VICTORY';
    }

    switch (mode) {
      case 'terminal-race':
        const trParticipant = participant as TerminalRaceParticipant;
        return trParticipant.stage > 0 ? 'PARTICIPATED' : 'DEFEATED';

      case 'king-of-the-hill':
        const kothParticipant = participant as KingOfTheHillParticipant;
        return kothParticipant.timesKing && kothParticipant.timesKing > 0 ? 'PARTICIPATED' : 'DEFEATED';

      case 'forensics-rush':
        const frParticipant = participant as ForensicsRushParticipant;
        return frParticipant.questionsAnswered && frParticipant.questionsAnswered > 0 ? 'PARTICIPATED' : 'DEFEATED';

      default:
        return participant.score > 0 ? 'PARTICIPATED' : 'DEFEATED';
    }
  };

  const getStatusClass = (participant: Participant, mode: string): string => {
    if (participant.isCompleted) {
      return 'victory';
    }

    switch (mode) {
      case 'terminal-race':
        const trParticipant = participant as TerminalRaceParticipant;
        return trParticipant.stage > 0 ? 'connected' : 'defeated';

      case 'king-of-the-hill':
        const kothParticipant = participant as KingOfTheHillParticipant;
        return kothParticipant.timesKing && kothParticipant.timesKing > 0 ? 'connected' : 'defeated';

      case 'forensics-rush':
        const frParticipant = participant as ForensicsRushParticipant;
        return frParticipant.questionsAnswered && frParticipant.questionsAnswered > 0 ? 'connected' : 'defeated';

      default:
        return participant.score > 0 ? 'connected' : 'defeated';
    }
  };

  // ✅ 게임 모드별 추가 정보 렌더링
  const renderParticipantDetails = (participant: Participant, mode: string) => {
    const coinsEarned = participant.coinsEarned || 0;
    const baseInfo = `${participant.score} pts • +${participant.expEarned} EXP • +${coinsEarned} HTO`;

    switch (mode) {
      case 'terminal-race':
        const trParticipant = participant as TerminalRaceParticipant;
        return `${baseInfo} • ${participant.isCompleted ? 'Completed' : `Stage ${trParticipant.stage + 1}`}`;

      case 'king-of-the-hill':
        const kothParticipant = participant as KingOfTheHillParticipant;
        const kingTime = kothParticipant.kingTime || 0;
        return `${baseInfo} • ${participant.isCompleted ? 'Completed' : `${kingTime}s as King`}`;

      case 'forensics-rush':
        const frParticipant = participant as ForensicsRushParticipant;
        const correctCount = frParticipant.questionsCorrect || 0;
        const totalQuestions = frParticipant.totalQuestions || 0;
        return `${baseInfo} • ${participant.isCompleted ? 'Perfect Score' : `${correctCount}/${totalQuestions} correct`}`;

      default:
        return `${baseInfo} • ${participant.isCompleted ? 'Completed' : 'In Progress'}`;
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

  // ✅ duration 계산
  const calculatedDuration = arenaResult.duration ||
    Math.floor((new Date(arenaResult.endTime).getTime() - new Date(arenaResult.startTime).getTime()) / 1000);

  return (
    <Main>
      <div className="ar-container">
        <div className="ar-grid-background"></div>

        {/* 게임 오버 헤더 */}
        <header className="ar-header">
          <div className="ar-game-over">
            <h1 className="ar-game-over-text">{arenaResult.name}</h1>
            <div className="ar-arena-mode">{arenaResult.mode.toUpperCase().replace('-', ' ')}</div>
            <div className="ar-mission-stats">
              <span className="ar-stat">{formatDuration(calculatedDuration)} MIN</span>
              <span className="ar-separator">|</span>
              <span className="ar-stat">{arenaResult.stats.totalParticipants}/{arenaResult.maxParticipants} {t('participants').toUpperCase()}</span>
              <span className="ar-separator">|</span>
              <span className="ar-stat">{arenaResult.stats.successRate}% SUCCESS</span>
            </div>
          </div>
        </header>

        {/* 순위 리스트 - 세로 리스트 레이아웃 */}
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
                    {participant.username}
                    {participant.userId === currentUserId && (
                      <span className="ar-you-tag">{i18n.language === 'ko' ? '나' : 'YOU'}</span>
                    )}
                  </div>
                  <div className={`ar-rank-player-status ${getStatusClass(participant, arenaResult.mode)}`}>
                    {getStatusText(participant, arenaResult.mode)}
                  </div>
                  <div className="ar-rank-player-details">
                    {renderParticipantDetails(participant, arenaResult.mode)}
                  </div>
                </div>

                {/* 완료 시간 */}
                {participant.completionTime !== null && (
                  <div className="ar-rank-completion-time">
                    {formatDuration(participant.completionTime)}
                  </div>
                )}
                {participant.completionTime === null && (
                  <div className="ar-rank-completion-time incomplete">
                    {i18n.language === 'ko' ? '미완료' : 'NOT COMPLETED'}
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
            {t('result.backToArena').toUpperCase()}
          </button>
          <button
            className="ar-button primary"
            onClick={() => navigate('/arena/create')}
          >
            {t('result.startNewMission').toUpperCase()}
          </button>
        </div>
      </div>
    </Main>
  );
};

export default ArenaResultPage;
