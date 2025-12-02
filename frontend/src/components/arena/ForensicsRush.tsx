// src/components/arena/ForensicsRush.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePlayContext } from '../../contexts/PlayContext'; // ✅ 추가
import '../../assets/scss/arena/ForensicsRush.scss';

type Participant = {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
  progress?: any;
};

interface ForensicsRushProps {
  arena: { _id: string; mode: string; };
  socket: Socket;
  currentUserId: string | null;
  participants: Participant[];
}

interface Question {
  id: string;
  question: { ko: string; en: string } | string;
  type: string;
  points: number;
  hints: { ko: string[]; en: string[] } | string[];
  difficulty: string;
  relatedFiles: string[];
}

interface EvidenceFile {
  id: string;
  name: string;
  type: string;
  path: string;
  description: string;
  content?: string;
}

interface AnsweredQuestion {
  questionId: string;
  correct: boolean;
  attempts: number;
}

interface ScenarioInfo {
  title: { ko: string; en: string } | string;
  description: { ko: string; en: string } | string;
  incidentType: string;
  date: string;
  context: { ko: string; en: string } | string;
}

interface ProgressData {
  score: number;
  questionsAnswered: number;
  questionsCorrect: number;
  totalAttempts: number;
  penalties: number;
  answers: any[];
  perfectScore?: boolean;
  totalQuestions: number;
}

const ForensicsRush: React.FC<ForensicsRushProps> = ({
  arena,
  socket,
  currentUserId,
  participants: _participants
}) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('arena');
  const { availableHints, useHint } = usePlayContext(); // ✅ 힌트 시스템 연동
  const [isLoading, setIsLoading] = useState(true);
  const [scenario, setScenario] = useState<ScenarioInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedEvidenceFile, setSelectedEvidenceFile] = useState<EvidenceFile | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [scoreChange, setScoreChange] = useState<number | null>(null);
  const [questionsCorrect, setQuestionsCorrect] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [unlockedHints, setUnlockedHints] = useState<Set<string>>(new Set()); // ✅ 힌트를 해금한 문제 ID 목록
  const [hintsVisible, setHintsVisible] = useState(false); // ✅ 현재 힌트 표시 여부 (토글용)
  const [allCompleted, setAllCompleted] = useState(false);
  const [itemNotifications, setItemNotifications] = useState<Array<{ id: number; message: string; timestamp: Date }>>([]);
  const [participantsStatus, setParticipantsStatus] = useState<Map<string, { username: string; completed: boolean; score: number }>>(new Map());
  const isInitializedRef = useRef(false);
  const notificationIdCounter = useRef(0);
  const isCompletedRef = useRef(false); // ✅ 완료 여부 추적용 ref

  // 유예시간은 ArenaPlayPage 헤더에서 통합 관리

  // 사용자 이름 가져오기 헬퍼 함수
  const getUsernameById = useCallback((userId: string): string => {
    const participant = _participants.find((p) => {
      const id = typeof p.user === 'string' ? p.user : p.user._id;
      return id === userId;
    });
    if (participant) {
      return typeof participant.user === 'string' ? t('game.user') : participant.user.username;
    }
    return t('game.unknown');
  }, [_participants, t]);

  // 참가자 초기 상태 설정
  useEffect(() => {
    const initialStatus = new Map();
    _participants.forEach(p => {
      const userId = typeof p.user === 'string' ? p.user : p.user._id;
      const username = typeof p.user === 'string' ? t('game.user') : p.user.username;
      initialStatus.set(userId, {
        username,
        completed: false,
        score: 0
      });
    });
    setParticipantsStatus(initialStatus);
  }, [_participants]);

  // 초기 데이터 로드
  useEffect(() => {
    if (isInitializedRef.current) return;

    const loadData = async () => {
      try {
        isInitializedRef.current = true;
        console.log('🔍 [ForensicsRush] Loading data for arena:', arena._id);

        socket.emit('forensics:get-scenario', { arenaId: arena._id });
        socket.emit('forensics:get-questions', { arenaId: arena._id });
        socket.emit('forensics:get-progress', { arenaId: arena._id });
        socket.emit('forensics:get-game-state', { arenaId: arena._id });

        setTimeout(() => {
          if (isLoading) {
            console.warn('⚠️ [ForensicsRush] Loading timeout');
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

  // ✅ 게임 종료 핸들러
  const handleArenaEnded = useCallback((_data: { message: string }) => {
    console.log('🏁 [ForensicsRush] Arena ended');
    setAllCompleted(true);
  }, []);

  // ✅ 결과 페이지로 리디렉션 핸들러
  const handleRedirectToResults = useCallback((data: { redirectUrl: string }) => {
    console.log('🎯 [ForensicsRush] Redirecting to results:', data.redirectUrl);
    setTimeout(() => {
      navigate(data.redirectUrl);
    }, 500);
  }, [navigate]);

  // ✅ 모든 참가자 완료 핸들러
  const handleAllCompleted = useCallback((data: { message: string }) => {
    console.log('🎉 [ForensicsRush] All participants completed:', data.message);
    setAllCompleted(true);
    // 리디렉션은 backend에서 arena:redirect-to-results 이벤트로 처리
  }, []);

  // 🎯 다른 플레이어 완료 핸들러
  const handlePlayerCompleted = useCallback((data: {
    userId: string;
    username: string;
    score: number;
  }) => {
    console.log('✅ [ForensicsRush] Player completed:', data);
    setParticipantsStatus(prev => {
      const newStatus = new Map(prev);
      newStatus.set(data.userId, {
        username: data.username,
        completed: true,
        score: data.score
      });
      return newStatus;
    });
  }, []);

  // 아이템 사용 알림 핸들러
  const handleItemUsed = useCallback((data: {
    userId: string;
    itemType: string;
    username?: string;
    value?: number;
    message?: string | { ko: string; en: string }
  }) => {
    // 백엔드 메시지 사용
    if (data.message) {
      const msg = typeof data.message === 'object'
        ? (i18n.language === 'ko' ? data.message.ko : data.message.en)
        : data.message;

      const notification = {
        id: notificationIdCounter.current++,
        message: msg,
        timestamp: new Date()
      };

      setItemNotifications(prev => [...prev, notification]);

      setTimeout(() => {
        setItemNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 5000);
      return;
    }

    // 레거시 처리
    const username = data.username || getUsernameById(data.userId);
    const isMe = data.userId === currentUserId;
    let itemName = 'item';

    switch (data.itemType) {
      case 'hint': itemName = t('game.hint'); break;
      case 'time_freeze':
      case 'time_extension': itemName = t('game.timeExtension'); break;
      case 'score_boost': itemName = t('game.scoreBoost'); break;
      case 'invincible': itemName = t('game.shield'); break;
    }

    const message = isMe
      ? `You used ${itemName}`
      : `${username} used ${itemName}`;

    const notification = {
      id: notificationIdCounter.current++,
      message,
      timestamp: new Date()
    };

    setItemNotifications(prev => [...prev, notification]);

    setTimeout(() => {
      setItemNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, [currentUserId, getUsernameById, i18n.language, t]);

  // ✅ 유예시간 시작 핸들러 - 알림 표시 (이미 완료한 사람은 제외)
  const handleGracePeriodStarted = useCallback((data: { graceSec: number; message: string }) => {
    // 이미 완료한 사용자는 경고 표시하지 않음
    if (isCompletedRef.current) return;

    const graceMin = Math.floor(data.graceSec / 60);
    const graceSec = data.graceSec % 60;
    const timeStr = graceMin > 0
      ? `${graceMin}:${String(graceSec).padStart(2, '0')}`
      : `${graceSec}s`;

    const graceMessage = i18n.language === 'ko'
      ? `⚠️ 유예 시간: 다른 플레이어가 완료했습니다! 남은 시간: ${timeStr}`
      : `⚠️ GRACE PERIOD: Another player completed! Time remaining: ${timeStr}`;

    const notification = {
      id: notificationIdCounter.current++,
      message: graceMessage,
      timestamp: new Date()
    };

    setItemNotifications(prev => [...prev, notification]);

    // 10초 후 자동 삭제 (중요한 알림이므로 더 오래 표시)
    setTimeout(() => {
      setItemNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 10000);
  }, [i18n.language]);

  // 소켓 이벤트 핸들러
  useEffect(() => {
    const handleScenarioData = (data: {
      scenario: ScenarioInfo;
      evidenceFiles: EvidenceFile[];
      availableTools: string[];
      totalQuestions: number;
    }) => {
      console.log('📨 [ForensicsRush] Scenario data received:', data);
      
      if (data.scenario) {
        setScenario(data.scenario);
        setEvidenceFiles(data.evidenceFiles || []);
        setAvailableTools(data.availableTools || []);
        setTotalQuestions(data.totalQuestions || 0);
        
        if (data.evidenceFiles && data.evidenceFiles.length > 0) {
          setSelectedEvidenceFile(data.evidenceFiles[0]);
        }
        
        setIsLoading(false);
      }
    };

    const handleQuestionsData = (data: { 
      questions: Question[];
      answeredQuestions: AnsweredQuestion[];
    }) => {
      console.log('📋 [ForensicsRush] Questions received:', data);
      
      if (data.questions) {
        setQuestions(data.questions);
      }
      
      if (data.answeredQuestions) {
        setAnsweredQuestions(data.answeredQuestions);
      }
    };

    const handleProgressData = (data: ProgressData) => {
      console.log('📊 [ForensicsRush] Progress data received:', data);
      
      setScore(data.score || 0);
      setQuestionsCorrect(data.questionsCorrect || 0);
      setTotalQuestions(data.totalQuestions || 0);
      
      if (data.questionsCorrect >= data.totalQuestions && data.totalQuestions > 0) {
        setAllCompleted(true);
      }
    };

    const handleResult = (data: {
      questionId: string;
      correct: boolean;
      message: string;
      points: number;
      penalty: number;
      totalScore: number;
      attempts: number;
      questionsAnswered: number;
      questionsCorrect: number;
      perfectScore?: boolean;
      allCompleted?: boolean;
    }) => {
      console.log('✅ [ForensicsRush] Result received:', data);
      
      setIsSubmitting(false);
      
      if (data.correct) {
        setFeedback({
          type: 'success',
          message: `${data.message} ${data.attempts === 1 ? '🎯 First try!' : ''}`
        });
        setUserAnswer('');

        // 점수 변화 표시
        if (data.points > 0) {
          setScoreChange(data.points);
          setTimeout(() => setScoreChange(null), 1500);
        }

        setScore(data.totalScore);
        setQuestionsCorrect(data.questionsCorrect);
        
        setAnsweredQuestions(prev => {
          const exists = prev.find(q => q.questionId === data.questionId);
          if (exists) {
            return prev.map(q => 
              q.questionId === data.questionId 
                ? { ...q, correct: true, attempts: data.attempts }
                : q
            );
          } else {
            return [...prev, { 
              questionId: data.questionId,
              correct: true,
              attempts: data.attempts
            }];
          }
        });

        // ✅ 모든 문제 완료 체크
        if (data.allCompleted) {
          console.log('🎉 [ForensicsRush] All questions completed!');
          setAllCompleted(true);
          isCompletedRef.current = true; // ✅ 완료 ref도 업데이트
        }
        
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback({
          type: 'error',
          message: data.message
        });

        // 점수 감소 표시 (penalty가 있으면)
        if (data.penalty > 0) {
          setScoreChange(-data.penalty);
          setTimeout(() => setScoreChange(null), 1500);
        }

        // 틀렸을 때도 점수 업데이트
        setScore(data.totalScore);

        setAnsweredQuestions(prev => {
          const exists = prev.find(q => q.questionId === data.questionId);
          if (exists) {
            return prev.map(q => 
              q.questionId === data.questionId 
                ? { ...q, attempts: data.attempts }
                : q
            );
          } else {
            return [...prev, { 
              questionId: data.questionId,
              correct: false,
              attempts: data.attempts
            }];
          }
        });
        
        setTimeout(() => setFeedback(null), 3000);
      }
    };

    const handleError = (data: { message: string }) => {
      console.error('❌ [ForensicsRush] Error:', data);
      setIsSubmitting(false);
      setFeedback({ 
        type: 'error', 
        message: data.message 
      });
      setTimeout(() => setFeedback(null), 3000);
    };

    // ✅ 게임 상태 핸들러 (유예시간은 ArenaPlayPage에서 관리)
    const handleGameState = (data: {
      isEnded: boolean;
    }) => {
      console.log('🎮 [ForensicsRush] Game state received:', data);

      if (data.isEnded) {
        setAllCompleted(true);
      }
    };

    // ✅ 이벤트 리스너 등록 (기존 리스너 제거 후 재등록)
    socket.off('forensics:scenario-data');
    socket.off('forensics:questions-data');
    socket.off('forensics:progress-data');
    socket.off('forensics:result');
    socket.off('forensics:error');
    socket.off('forensics:game-state');
    socket.off('arena:ended');
    socket.off('arena:redirect-to-results');
    socket.off('forensics:all-completed');
    socket.off('arena:item-used');
    // arena:grace-period-started는 ArenaPlayPage와 공유하므로 특정 핸들러만 제거
    socket.off('arena:grace-period-started', handleGracePeriodStarted);

    socket.on('forensics:scenario-data', handleScenarioData);
    socket.on('forensics:questions-data', handleQuestionsData);
    socket.on('forensics:progress-data', handleProgressData);
    socket.on('forensics:result', handleResult);
    socket.on('forensics:error', handleError);
    socket.on('forensics:game-state', handleGameState);
    socket.on('arena:ended', handleArenaEnded);
    socket.on('arena:redirect-to-results', handleRedirectToResults);
    socket.on('forensics:all-completed', handleAllCompleted);
    socket.on('forensics:player-completed', handlePlayerCompleted);
    socket.on('arena:item-used', handleItemUsed);
    socket.on('arena:grace-period-started', handleGracePeriodStarted);

    return () => {
      // ✅ 이벤트 리스너 제거
      socket.off('forensics:scenario-data', handleScenarioData);
      socket.off('forensics:questions-data', handleQuestionsData);
      socket.off('forensics:progress-data', handleProgressData);
      socket.off('forensics:result', handleResult);
      socket.off('forensics:error', handleError);
      socket.off('forensics:game-state', handleGameState);
      socket.off('arena:ended', handleArenaEnded);
      socket.off('arena:redirect-to-results', handleRedirectToResults);
      socket.off('forensics:all-completed', handleAllCompleted);
      socket.off('forensics:player-completed', handlePlayerCompleted);
      socket.off('arena:item-used', handleItemUsed);
      socket.off('arena:grace-period-started', handleGracePeriodStarted);
    };
  }, [socket, handleArenaEnded, handleRedirectToResults, handleAllCompleted, handlePlayerCompleted, handleItemUsed, handleGracePeriodStarted]);

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim() || isSubmitting || !currentQuestion) return;

    setIsSubmitting(true);
    
    socket.emit('forensics:submit-answer', {
      arenaId: arena._id,
      questionId: currentQuestion.id,
      answer: userAnswer.trim()
    });
  };

  const getFileIcon = (type: string) => {
    switch(type) {
      case 'log': return '[LOG]';
      case 'pcap': return '[PCAP]';
      case 'image': return '[IMG]';
      case 'disk': return '[DISK]';
      case 'memory': return '[MEM]';
      case 'network': return '[NET]';
      default: return '[FILE]';
    }
  };

  const getAnsweredQuestion = (questionId: string): AnsweredQuestion | undefined => {
    return answeredQuestions.find(q => q.questionId === questionId);
  };

  const currentQuestion = questions[currentQuestionIndex];
  const previousAnswer = currentQuestion ? getAnsweredQuestion(currentQuestion.id) : undefined;
  const isAnswered = previousAnswer?.correct || false;
  const relatedEvidenceFiles = currentQuestion 
    ? evidenceFiles.filter(f => currentQuestion.relatedFiles?.includes(f.id))
    : [];

  // const formatTime = (seconds: number | null): string => {
  //   if (seconds === null) return '--:--';
  //   const mins = Math.floor(seconds / 60);
  //   const secs = seconds % 60;
  //   return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  // };

  if (isLoading) {
    return (
      <div className="forensics-rush-container loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h3>Preparing Forensics Investigation...</h3>
          <p>Loading case files and evidence...</p>
        </div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="forensics-rush-container error">
        <div className="error-content">
          <h3>⚠️ Investigation Not Found</h3>
          <p>Unable to load forensics scenario. Please try again.</p>
        </div>
      </div>
    );
  }

  // ✅ 모든 문제 완료 시 터미널 화면
  if (allCompleted && questionsCorrect === totalQuestions && totalQuestions > 0) {
    return (
      <div className="forensics-rush-container completion">
        <div className="terminal-window completion-terminal">
          <div className="terminal-header">
            <div className="terminal-title">INVESTIGATION COMPLETE</div>
          </div>
          <div className="terminal-body">
            <div className="ascii-art">
{`
 ███████╗ ██████╗ ██████╗ ███████╗███╗   ██╗███████╗██╗ ██████╗███████╗
 ██╔════╝██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██║██╔════╝██╔════╝
 █████╗  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║███████╗██║██║     ███████╗
 ██╔══╝  ██║   ██║██╔══██╗██╔══╝  ██║╚██╗██║╚════██║██║██║     ╚════██║
 ██║     ╚██████╔╝██║  ██║███████╗██║ ╚████║███████║██║╚██████╗███████║
 ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚══════╝╚═╝ ╚═════╝╚══════╝
`}
            </div>

            <div className="completion-messages">
              <div className="message-line">
                <span className="prompt">$</span> cat investigation_summary.txt
              </div>
              <div className="output-block">
                <div className="summary-line">================================================</div>
                <div className="summary-line">  {t('forensics.investigationSummary')}</div>
                <div className="summary-line">================================================</div>
                <div className="summary-line"></div>
                <div className="summary-line">
                  {t('forensics.case')}: {typeof scenario.title === 'object'
                    ? (scenario.title as any)[i18n.language] || (scenario.title as any).ko || (scenario.title as any).en || scenario.incidentType
                    : scenario.title || scenario.incidentType}
                </div>
                <div className="summary-line">  {t('forensics.incident')}: {scenario.incidentType}</div>
                <div className="summary-line"></div>
                <div className="summary-line">  {t('forensics.questionsSolved')}: {questionsCorrect}/{totalQuestions}</div>
                <div className="summary-line">  {t('forensics.totalScore')}: {score} pts</div>
                <div className="summary-line"></div>
                <div className="summary-line">================================================</div>
              </div>

              {/* 다른 플레이어 상태 표시 */}
              <div className="message-line">
                <span className="prompt">$</span> ./check_team_status.sh
              </div>
              <div className="output-block">
                <div className="summary-line">================================================</div>
                <div className="summary-line">  {t('forensics.teamStatus')}</div>
                <div className="summary-line">================================================</div>
                {Array.from(participantsStatus.entries()).map(([userId, status]) => (
                  <div key={userId} className="summary-line" style={{
                    color: status.completed ? '#00ff88' : '#ffaa00',
                    paddingLeft: '  '
                  }}>
                    {status.completed ? '✓' : '○'} {status.username} {userId === currentUserId ? '(YOU)' : ''} - {status.completed ? `${t('forensics.completed')} (${status.score} pts)` : t('forensics.inProgress')}
                  </div>
                ))}
                <div className="summary-line">================================================</div>
              </div>

              {/* 완료 메시지 - 유예시간은 ArenaPlayPage 헤더에서 표시 */}
              {Array.from(participantsStatus.values()).every(p => p.completed) ? (
                <>
                  <div className="message-line">
                    <span className="prompt">$</span> ./finalize_investigation.sh
                  </div>
                  <div className="output-line success game-over-box">
                    <div className="game-over-title">🏁 {t('forensics.gameOver')} 🏁</div>
                    <div className="game-over-message">{t('forensics.allAgentsSubmitted')}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="message-line">
                    <span className="prompt">$</span> ./check_deadline.sh
                  </div>
                  <div className="output-line warning">
                    [PRIORITY] {t('forensics.awaitingReports')}
                  </div>
                </>
              )}

              <div className="message-line">
                <span className="prompt">$</span> <span className="cursor">_</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forensics-rush-container">
      {/* 헤더 */}
      <div className="forensics-header">
        <div className="header-left">
          <div className="agency-badge">{t('forensics.labTitle')}</div>
          <h1 className="case-title">
            {typeof scenario.title === 'object'
              ? (scenario.title as any)[i18n.language] || (scenario.title as any).ko || (scenario.title as any).en
              : scenario.title}
          </h1>
          <div className="case-meta">
            <span className="incident-type">[{scenario.incidentType}]</span>
            <span className="case-date">DATE: {scenario.date}</span>
          </div>
        </div>

        {/* 아이템 사용 알림 - 헤더 중앙 */}
        {itemNotifications.length > 0 && (
          <div className="header-center-notification">
            {itemNotifications.slice(-1).map((notification) => (
              <div key={notification.id} className="item-notification">
                {notification.message}
              </div>
            ))}
          </div>
        )}
        
        <div className="header-right">
          <div className={`stat-card ${scoreChange !== null ? (scoreChange > 0 ? 'score-up' : 'score-down') : ''}`}>
            <div className="stat-label">Score</div>
            <div className="stat-value">
              {score}
              {scoreChange !== null && (
                <span className={`score-change ${scoreChange > 0 ? 'positive' : 'negative'}`}>
                  {scoreChange > 0 ? '+' : ''}{scoreChange}
                </span>
              )}
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-label">Solved</div>
            <div className="stat-value">{questionsCorrect}/{totalQuestions}</div>
          </div>

          {allCompleted && (
            <div className="completion-badge">
              [{t('forensics.caseClosed').toUpperCase()}]
            </div>
          )}
        </div>
      </div>


      {/* 시나리오 설명 */}
      <div className="scenario-brief">
        <div className="brief-header">
          <span className="brief-title">{t('forensics.caseBrief')}</span>
          <span className="classification">{t('forensics.classified')}</span>
        </div>
        <p className="brief-description">
          {typeof scenario.description === 'object'
            ? (scenario.description as any)[i18n.language] || (scenario.description as any).ko || (scenario.description as any).en
            : scenario.description}
        </p>
        <p className="brief-context">
          {typeof scenario.context === 'object'
            ? (scenario.context as any)[i18n.language] || (scenario.context as any).ko || (scenario.context as any).en
            : scenario.context}
        </p>
      </div>

      {/* 메인 영역 */}
      {questions.length > 0 && (
        <div className="forensics-workspace">
          {/* Evidence 터미널 */}
          <div className="evidence-terminal terminal-window">
            <div className="terminal-header">
              <div className="terminal-title">{t('forensics.evidenceFiles')}</div>
            </div>
            <div className="terminal-body">
              <div className="file-list">
                <div className="list-header">$ ls -la /evidence/</div>
                {evidenceFiles.map((file) => {
                  const isRelated = currentQuestion?.relatedFiles?.includes(file.id);
                  const isSelected = selectedEvidenceFile?.id === file.id;
                  
                  return (
                    <div
                      key={file.id}
                      className={`file-item ${isSelected ? 'selected' : ''} ${isRelated ? 'related' : ''}`}
                      onClick={() => setSelectedEvidenceFile(file)}
                    >
                      <span className="file-icon">{getFileIcon(file.type)}</span>
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{Math.floor(Math.random() * 900 + 100)}KB</span>
                      {isRelated && <span className="flag-badge">[RELEVANT]</span>}
                    </div>
                  );
                })}
              </div>

              {selectedEvidenceFile && (
                <div className="file-viewer">
                  <div className="viewer-header">
                    $ cat {selectedEvidenceFile.path}
                  </div>
                  <div className="viewer-toolbar">
                    <span className="toolbar-label">{t('forensics.tools')}:</span>
                    {availableTools.slice(0, 6).map(tool => (
                      <span key={tool} className="tool-chip">{tool}</span>
                    ))}
                  </div>
                  <div className="viewer-content">
                    <pre className="file-content">
{selectedEvidenceFile.content || `# File: ${selectedEvidenceFile.name}
# Path: ${selectedEvidenceFile.path}
# Type: ${selectedEvidenceFile.type}
# Description: ${selectedEvidenceFile.description}

[Evidence file content would be displayed here]

Use forensics tools to analyze this file.
Look for: suspicious patterns, IP addresses, timestamps.`}
                    </pre>
                  </div>
                </div>
              )}

              {relatedEvidenceFiles.length > 0 && (
                <div className="hint-box">
                  <div className="hint-header">[{t('forensics.analystNote').toUpperCase()}]</div>
                  <div className="hint-content">
                    {t('forensics.relatedEvidence')}:
                    <ul>
                      {relatedEvidenceFiles.map(file => (
                        <li key={file.id}>{file.name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 질문 터미널 */}
          <div className="question-terminal terminal-window">
            <div className="terminal-header">
              <div className="terminal-title">{t('forensics.investigationQuery')}</div>
            </div>
            <div className="terminal-body">
              {currentQuestion && (
                <div className="question-content">
                  <div className="question-meta">
                    <span className="q-number">[Q{currentQuestionIndex + 1}/{questions.length}]</span>
                    <span className={`difficulty-tag diff-${currentQuestion.difficulty}`}>
                      {currentQuestion.difficulty.toUpperCase()}
                    </span>
                    <span className="points-tag">{currentQuestion.points}pts</span>
                  </div>

                  <div className="question-text">
                    <span className="prompt">$</span> {typeof currentQuestion.question === 'object'
                      ? (currentQuestion.question as any)[i18n.language] || (currentQuestion.question as any).ko || (currentQuestion.question as any).en
                      : currentQuestion.question}
                  </div>

                  {isAnswered ? (
                    <div className="answered-status">
                      <div className="status-message">
                        [{t('forensics.verified')}] {t('forensics.evidenceConfirmed')} ({previousAnswer?.attempts || 1} {(previousAnswer?.attempts || 1) !== 1 ? t('forensics.attempts') : t('forensics.attempt')})
                      </div>
                      {currentQuestionIndex < questions.length - 1 && (
                        <button
                          className="terminal-button next"
                          onClick={() => {
                            setCurrentQuestionIndex(prev => prev + 1);
                            setUserAnswer('');
                            setFeedback(null);
                            setHintsVisible(false); // ✅ 다음 문제로 이동 시 힌트 숨김 (해금은 유지)
                          }}
                        >
                          {t('forensics.nextQuestion')} →
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <form className="answer-terminal" onSubmit={handleSubmitAnswer}>
                        <div className="terminal-input-line">
                          <span className="input-prompt">{'> '}</span>
                          <input
                            type="text"
                            className="terminal-input"
                            placeholder={t('game.typeAnswer')}
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            disabled={isSubmitting || allCompleted}
                            autoFocus
                          />
                        </div>
                        
                        <div className="terminal-actions">
                          <button
                            type="submit"
                            className="terminal-button submit"
                            disabled={!userAnswer.trim() || isSubmitting || allCompleted}
                          >
                            {isSubmitting ? `[${t('forensics.analyzing').toUpperCase()}]` : allCompleted ? `[${t('forensics.complete').toUpperCase()}]` : `[${t('forensics.submit').toUpperCase()}]`}
                          </button>

                          {/* ✅ 힌트 아이템 사용 버튼 */}
                          <button
                            type="button"
                            className="terminal-button hint"
                            onClick={() => {
                              const questionId = currentQuestion?.id;
                              if (!questionId) return;

                              const isUnlocked = unlockedHints.has(questionId);

                              if (!isUnlocked && availableHints > 0) {
                                // 힌트 아이템 사용하여 해금
                                useHint();
                                setUnlockedHints(prev => new Set(prev).add(questionId));
                                setHintsVisible(true);
                              } else if (isUnlocked) {
                                // 이미 해금된 경우 토글만
                                setHintsVisible(prev => !prev);
                              }
                            }}
                            disabled={allCompleted || (!unlockedHints.has(currentQuestion?.id || '') && availableHints === 0)}
                          >
                            {unlockedHints.has(currentQuestion?.id || '')
                              ? (hintsVisible ? `[${t('forensics.hideHints').toUpperCase()}]` : `[${t('forensics.showHints').toUpperCase()}]`)
                              : availableHints > 0
                                ? `[${t('forensics.useHint').toUpperCase()} (${availableHints})]`
                                : `[${t('forensics.noHints').toUpperCase()}]`
                            }
                          </button>
                        </div>
                      </form>

                      {feedback && (
                        <div className={`terminal-feedback ${feedback.type}`}>
                          <span className="feedback-icon">{feedback.type === 'success' ? `[${t('forensics.match').toUpperCase()}]` : `[${t('forensics.denied').toUpperCase()}]`}</span>
                          {feedback.message}
                        </div>
                      )}

                      {/* ✅ 힌트 표시 (해금된 문제이고 visible 상태일 때만 표시) */}
                      {hintsVisible && unlockedHints.has(currentQuestion?.id || '') && currentQuestion.hints && (() => {
                        // 다국어 지원: hints가 객체인 경우 현재 언어로 선택
                        const lang = i18n.language as 'ko' | 'en';
                        const hintsArray = typeof currentQuestion.hints === 'object' && 'ko' in currentQuestion.hints
                          ? currentQuestion.hints[lang] || currentQuestion.hints.ko || currentQuestion.hints.en
                          : currentQuestion.hints as string[];

                        return hintsArray && hintsArray.length > 0 ? (
                          <div className="hints-terminal">
                            <div className="hints-header">{t('forensics.hints').toUpperCase()} ({t('forensics.unlocked')}):</div>
                            <ul className="hints-list">
                              {hintsArray.map((hint: string, index: number) => (
                                <li key={index}>
                                  <span className="hint-bullet">▸</span> {hint}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null;
                      })()}

                      {previousAnswer && !previousAnswer.correct && (
                        <div className="attempts-display">
                          {t('forensics.previousAttempts')}: {previousAnswer.attempts}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="questions-nav-terminal">
                <div className="nav-header">$ ./list_questions.sh</div>
                <div className="questions-grid-terminal">
                  {questions.map((q, index) => {
                    const answer = getAnsweredQuestion(q.id);
                    const isCurrent = index === currentQuestionIndex;
                    const isCompleted = answer?.correct || false;
                    
                    return (
                      <button
                        key={q.id}
                        className={`question-chip ${isCurrent ? 'active' : ''} ${isCompleted ? 'solved' : ''}`}
                        onClick={() => {
                          setCurrentQuestionIndex(index);
                          setUserAnswer('');
                          setFeedback(null);
                          setHintsVisible(false); // ✅ 문제 변경 시 힌트 숨김 (해금은 유지)
                        }}
                        title={typeof q.question === 'object'
                          ? (q.question as any)[i18n.language] || (q.question as any).ko || (q.question as any).en
                          : q.question}
                        disabled={allCompleted}
                      >
                        {isCompleted ? 'OK' : `Q${index + 1}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForensicsRush;