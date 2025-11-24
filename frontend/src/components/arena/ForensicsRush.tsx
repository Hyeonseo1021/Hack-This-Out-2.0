// src/components/arena/ForensicsRush.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
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
  question: string;
  type: string;
  points: number;
  hints: string[];
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
  title: string;
  description: string;
  incidentType: string;
  date: string;
  context: string;
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
  const [questionsCorrect, setQuestionsCorrect] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [unlockedHints, setUnlockedHints] = useState<Set<string>>(new Set()); // ✅ 힌트를 해금한 문제 ID 목록
  const [hintsVisible, setHintsVisible] = useState(false); // ✅ 현재 힌트 표시 여부 (토글용)
  const [allCompleted, setAllCompleted] = useState(false);
  const [itemNotifications, setItemNotifications] = useState<Array<{ id: number; message: string; timestamp: Date }>>([]);
  const isInitializedRef = useRef(false);
  const notificationIdCounter = useRef(0);

  // 🎯 타이머 관련 state
  const [gameTimeRemaining, setGameTimeRemaining] = useState<number | null>(null);
  const [gracePeriodRemaining, setGracePeriodRemaining] = useState<number | null>(null);
  const [firstWinner, setFirstWinner] = useState<string | null>(null);
  const gameTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gracePeriodIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 사용자 이름 가져오기 헬퍼 함수
  const getUsernameById = useCallback((userId: string): string => {
    const participant = _participants.find((p) => {
      const id = typeof p.user === 'string' ? p.user : p.user._id;
      return id === userId;
    });
    if (participant) {
      return typeof participant.user === 'string' ? 'User' : participant.user.username;
    }
    return 'Unknown';
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

  // ✅ 유예 시간 시작 핸들러
  const handleGracePeriodStarted = useCallback((data: { 
    gracePeriodSeconds: number; 
    firstWinner: string;
    message: string;
  }) => {
    console.log('⏰ [ForensicsRush] Grace period started:', data);
    
    setGracePeriodRemaining(data.gracePeriodSeconds);
    setFirstWinner(data.firstWinner);
    
    // 기존 타이머 정리
    if (gameTimerIntervalRef.current) {
      clearInterval(gameTimerIntervalRef.current);
      gameTimerIntervalRef.current = null;
    }
    
    // 유예 시간 타이머 시작
    if (gracePeriodIntervalRef.current) {
      clearInterval(gracePeriodIntervalRef.current);
    }
    
    gracePeriodIntervalRef.current = setInterval(() => {
      setGracePeriodRemaining((prev) => {
        if (prev === null || prev <= 1) {
          if (gracePeriodIntervalRef.current) {
            clearInterval(gracePeriodIntervalRef.current);
            gracePeriodIntervalRef.current = null;
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ✅ 게임 종료 핸들러
  const handleArenaEnded = useCallback((data: { message: string }) => {
    console.log('🏁 [ForensicsRush] Arena ended:', data);
    
    // 모든 타이머 정리
    if (gameTimerIntervalRef.current) {
      clearInterval(gameTimerIntervalRef.current);
      gameTimerIntervalRef.current = null;
    }
    if (gracePeriodIntervalRef.current) {
      clearInterval(gracePeriodIntervalRef.current);
      gracePeriodIntervalRef.current = null;
    }
    
    setGracePeriodRemaining(null);
    setGameTimeRemaining(null);
    
    // 완료 상태로 설정
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

    // 유예 기간 타이머 정리
    if (gracePeriodIntervalRef.current) {
      clearInterval(gracePeriodIntervalRef.current);
      gracePeriodIntervalRef.current = null;
    }

    setGracePeriodRemaining(null);
    setAllCompleted(true);

    // ✅ 리디렉션은 backend에서 arena:redirect-to-results 이벤트로 처리
    // (endArenaProcedure가 완료된 후 2초 뒤에 전송됨)
  }, []);

  // ✅ 아이템 사용 알림 핸들러
  const handleItemUsed = useCallback((data: { userId: string; itemType: string; username?: string }) => {
    console.log('🎁 [ForensicsRush] Item used:', data);

    const username = data.username || getUsernameById(data.userId);
    const isMe = data.userId === currentUserId;

    let itemEmoji = '🎁';
    let itemName = 'Item';

    switch (data.itemType) {
      case 'hint':
        itemEmoji = '💡';
        itemName = 'Hint';
        break;
      case 'time_freeze':
        itemEmoji = '⏰';
        itemName = 'Time Extension';
        break;
      case 'score_boost':
        itemEmoji = '🚀';
        itemName = 'Score Boost';
        break;
      case 'invincible':
        itemEmoji = '🛡️';
        itemName = 'Shield';
        break;
    }

    const message = isMe
      ? `[SYSTEM] You used ${itemEmoji} ${itemName}`
      : `[SYSTEM] ${username} used ${itemEmoji} ${itemName}`;

    const notification = {
      id: notificationIdCounter.current++,
      message,
      timestamp: new Date()
    };

    setItemNotifications(prev => [...prev, notification]);

    // 5초 후 자동 제거
    setTimeout(() => {
      setItemNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, [currentUserId, getUsernameById]);

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
        }
        
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback({ 
          type: 'error', 
          message: data.message 
        });
        
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

    // ✅ 게임 상태 핸들러
    const handleGameState = (data: {
      gameTimeRemaining: number | null;
      gracePeriodRemaining: number | null;
      firstWinner: string | null;
      isEnded: boolean;
    }) => {
      console.log('🎮 [ForensicsRush] Game state received:', data);
      
      setGameTimeRemaining(data.gameTimeRemaining);
      setGracePeriodRemaining(data.gracePeriodRemaining);
      setFirstWinner(data.firstWinner);
      
      if (data.isEnded) {
        setAllCompleted(true);
      }
      
      // 게임 타이머 설정
      if (data.gameTimeRemaining !== null && data.gameTimeRemaining > 0) {
        if (gameTimerIntervalRef.current) {
          clearInterval(gameTimerIntervalRef.current);
        }
        
        gameTimerIntervalRef.current = setInterval(() => {
          setGameTimeRemaining((prev) => {
            if (prev === null || prev <= 1) {
              if (gameTimerIntervalRef.current) {
                clearInterval(gameTimerIntervalRef.current);
                gameTimerIntervalRef.current = null;
              }
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
      
      // 유예 시간 타이머 설정
      if (data.gracePeriodRemaining !== null && data.gracePeriodRemaining > 0) {
        if (gracePeriodIntervalRef.current) {
          clearInterval(gracePeriodIntervalRef.current);
        }
        
        gracePeriodIntervalRef.current = setInterval(() => {
          setGracePeriodRemaining((prev) => {
            if (prev === null || prev <= 1) {
              if (gracePeriodIntervalRef.current) {
                clearInterval(gracePeriodIntervalRef.current);
                gracePeriodIntervalRef.current = null;
              }
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
    };

    // ✅ 이벤트 리스너 등록 (기존 리스너 제거 후 재등록)
    socket.off('forensics:scenario-data');
    socket.off('forensics:questions-data');
    socket.off('forensics:progress-data');
    socket.off('forensics:result');
    socket.off('forensics:error');
    socket.off('forensics:game-state');
    socket.off('arena:grace-period-started');
    socket.off('arena:ended');
    socket.off('arena:redirect-to-results');
    socket.off('forensics:all-completed');
    socket.off('arena:item-used');

    socket.on('forensics:scenario-data', handleScenarioData);
    socket.on('forensics:questions-data', handleQuestionsData);
    socket.on('forensics:progress-data', handleProgressData);
    socket.on('forensics:result', handleResult);
    socket.on('forensics:error', handleError);
    socket.on('forensics:game-state', handleGameState);
    socket.on('arena:grace-period-started', handleGracePeriodStarted);
    socket.on('arena:ended', handleArenaEnded);
    socket.on('arena:redirect-to-results', handleRedirectToResults);
    socket.on('forensics:all-completed', handleAllCompleted);
    socket.on('arena:item-used', handleItemUsed);

    return () => {
      // ✅ 타이머 정리
      if (gameTimerIntervalRef.current) {
        clearInterval(gameTimerIntervalRef.current);
        gameTimerIntervalRef.current = null;
      }
      if (gracePeriodIntervalRef.current) {
        clearInterval(gracePeriodIntervalRef.current);
        gracePeriodIntervalRef.current = null;
      }

      // ✅ 이벤트 리스너 제거
      socket.off('forensics:scenario-data', handleScenarioData);
      socket.off('forensics:questions-data', handleQuestionsData);
      socket.off('forensics:progress-data', handleProgressData);
      socket.off('forensics:result', handleResult);
      socket.off('forensics:error', handleError);
      socket.off('forensics:game-state', handleGameState);
      socket.off('arena:grace-period-started', handleGracePeriodStarted);
      socket.off('arena:ended', handleArenaEnded);
      socket.off('arena:redirect-to-results', handleRedirectToResults);
      socket.off('forensics:all-completed', handleAllCompleted);
      socket.off('arena:item-used', handleItemUsed);
    };
  }, [socket, handleGracePeriodStarted, handleArenaEnded, handleRedirectToResults, handleAllCompleted, handleItemUsed]);

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

  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
                <div className="summary-line">  INVESTIGATION SUMMARY</div>
                <div className="summary-line">================================================</div>
                <div className="summary-line"></div>
                <div className="summary-line">  Case: {scenario.title}</div>
                <div className="summary-line">  Incident: {scenario.incidentType}</div>
                <div className="summary-line"></div>
                <div className="summary-line">  Questions Solved: {questionsCorrect}/{totalQuestions}</div>
                <div className="summary-line">  Total Score: {score} points</div>
                <div className="summary-line"></div>
                <div className="summary-line">================================================</div>
              </div>

              {gracePeriodRemaining !== null && firstWinner && (
                <>
                  <div className="message-line">
                    <span className="prompt">$</span> ./check_status.sh
                  </div>
                  <div className="output-line warning">
                    {firstWinner === currentUserId
                      ? "[PRIORITY] Awaiting field reports from remaining agents..."
                      : `[ALERT] Evidence submission deadline: T-${gracePeriodRemaining}s`
                    }
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
      {/* ✅ 아이템 사용 알림 */}
      {itemNotifications.length > 0 && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '400px'
        }}>
          {itemNotifications.map((notification) => (
            <div
              key={notification.id}
              style={{
                backgroundColor: 'rgba(0, 245, 255, 0.1)',
                border: '1px solid rgba(0, 245, 255, 0.3)',
                padding: '12px 16px',
                borderRadius: '4px',
                color: '#00f5ff',
                fontFamily: 'monospace',
                fontSize: '13px',
                boxShadow: '0 4px 12px rgba(0, 245, 255, 0.2)',
                animation: 'slideInRight 0.3s ease-out'
              }}
            >
              {notification.message}
            </div>
          ))}
        </div>
      )}

      {/* 헤더 */}
      <div className="forensics-header">
        <div className="header-left">
          <div className="agency-badge">DIGITAL FORENSICS LAB</div>
          <h1 className="case-title">{scenario.title}</h1>
          <div className="case-meta">
            <span className="incident-type">[{scenario.incidentType}]</span>
            <span className="case-date">DATE: {scenario.date}</span>
          </div>
        </div>
        
        <div className="header-right">
          <div className="stat-card">
            <div className="stat-label">Score</div>
            <div className="stat-value">{score}</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-label">Solved</div>
            <div className="stat-value">{questionsCorrect}/{totalQuestions}</div>
          </div>

          {/* ✅ 유예 시간만 표시 (ForensicsRush는 시간 제한 없음) */}
          {gracePeriodRemaining !== null && (
            <div className="stat-card grace-card">
              <div className="stat-label">DEADLINE</div>
              <div className="stat-value warning">{gracePeriodRemaining}s</div>
            </div>
          )}
          
          {allCompleted && (
            <div className="completion-badge">
              [CASE CLOSED]
            </div>
          )}
        </div>
      </div>


      {/* 시나리오 설명 */}
      <div className="scenario-brief">
        <div className="brief-header">
          <span className="brief-title">CASE BRIEF</span>
          <span className="classification">CLASSIFIED</span>
        </div>
        <p className="brief-description">{scenario.description}</p>
        <p className="brief-context">{scenario.context}</p>
      </div>

      {/* 메인 영역 */}
      {questions.length > 0 && (
        <div className="forensics-workspace">
          {/* Evidence 터미널 */}
          <div className="evidence-terminal terminal-window">
            <div className="terminal-header">
              <div className="terminal-title">EVIDENCE FILES</div>
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
                    <span className="toolbar-label">TOOLS:</span>
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
                  <div className="hint-header">[ANALYST NOTE]</div>
                  <div className="hint-content">
                    Related evidence for current investigation:
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
              <div className="terminal-title">INVESTIGATION QUERY</div>
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
                    <span className="prompt">$</span> {currentQuestion.question}
                  </div>

                  {isAnswered ? (
                    <div className="answered-status">
                      <div className="status-message">
                        [VERIFIED] Evidence confirmed ({previousAnswer?.attempts || 1} attempt{previousAnswer?.attempts !== 1 ? 's' : ''})
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
                          NEXT QUESTION →
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
                            placeholder="Type your answer..."
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
                            {isSubmitting ? '[ANALYZING...]' : allCompleted ? '[COMPLETE]' : '[SUBMIT]'}
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
                              ? (hintsVisible ? '[HIDE HINTS]' : '[SHOW HINTS]')
                              : availableHints > 0
                                ? `[USE HINT (${availableHints})]`
                                : '[NO HINTS]'
                            }
                          </button>
                        </div>
                      </form>

                      {feedback && (
                        <div className={`terminal-feedback ${feedback.type}`}>
                          <span className="feedback-icon">{feedback.type === 'success' ? '[MATCH]' : '[DENIED]'}</span>
                          {feedback.message}
                        </div>
                      )}

                      {/* ✅ 힌트 표시 (해금된 문제이고 visible 상태일 때만 표시) */}
                      {hintsVisible && unlockedHints.has(currentQuestion?.id || '') && currentQuestion.hints && currentQuestion.hints.length > 0 && (
                        <div className="hints-terminal">
                          <div className="hints-header">HINTS (Unlocked):</div>
                          <ul className="hints-list">
                            {currentQuestion.hints.map((hint, index) => (
                              <li key={index}>
                                <span className="hint-bullet">▸</span> {hint}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {previousAnswer && !previousAnswer.correct && (
                        <div className="attempts-display">
                          Previous attempts: {previousAnswer.attempts}
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
                        title={q.question}
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