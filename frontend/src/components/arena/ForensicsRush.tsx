// src/components/arena/ForensicsRush.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
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
  participants 
}) => {
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
  const [showHints, setShowHints] = useState(false);
  const [allCompleted, setAllCompleted] = useState(false);
  const [evidenceClosed, setEvidenceClosed] = useState(false);
  const isInitializedRef = useRef(false);

  // 🎯 타이머 관련 state
  const [gameTimeRemaining, setGameTimeRemaining] = useState<number | null>(null);
  const [gracePeriodRemaining, setGracePeriodRemaining] = useState<number | null>(null);
  const [firstWinner, setFirstWinner] = useState<string | null>(null);
  const gameTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gracePeriodIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        socket.emit('forensics:get-game-state', { arenaId: arena._id }); // 🎯 게임 상태 요청 추가

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
        
        if (data.allCompleted) {
          console.log('🎉 [ForensicsRush] All questions completed!');
          setAllCompleted(true);
        } else {
          setTimeout(() => {
            if (currentQuestionIndex < questions.length - 1) {
              setCurrentQuestionIndex(prev => prev + 1);
            }
            setFeedback(null);
            setShowHints(false);
          }, 1500);
        }
      } else {
        setFeedback({ 
          type: 'error', 
          message: data.message 
        });
        
        setTimeout(() => setFeedback(null), 3000);
      }
    };

    const handleSubmitFailed = (data: { reason: string; questionId: string }) => {
      console.log('❌ [ForensicsRush] Submit failed:', data);
      setIsSubmitting(false);
      setFeedback({ type: 'error', message: data.reason });
      setTimeout(() => setFeedback(null), 3000);
    };

    const handleError = (data: { message: string }) => {
      console.error('❌ [ForensicsRush] Error:', data);
      setIsSubmitting(false);
      setFeedback({ type: 'error', message: data.message });
      setTimeout(() => setFeedback(null), 3000);
    };

    // 🎯 게임 타이머 시작
    const handleGameTimerStarted = (data: { durationMs: number; expiresAt: string }) => {
      console.log('⏲️ [ForensicsRush] Game timer started:', data);
      
      const expiresAt = new Date(data.expiresAt);
      
      if (gameTimerIntervalRef.current) {
        clearInterval(gameTimerIntervalRef.current);
      }
      
      const updateTimer = () => {
        const now = new Date();
        const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
        
        if (remaining <= 0) {
          setGameTimeRemaining(0);
          if (gameTimerIntervalRef.current) {
            clearInterval(gameTimerIntervalRef.current);
          }
        } else {
          setGameTimeRemaining(remaining);
        }
      };
      
      updateTimer();
      gameTimerIntervalRef.current = setInterval(updateTimer, 1000);
    };

    // 🎯 게임 상태 복원 (새로고침 시)
    const handleGameState = (data: { 
      gameTimerExpiresAt?: string;
      gracePeriodExpiresAt?: string;
      firstWinner?: string;
    }) => {
      console.log('🔄 [ForensicsRush] Game state received:', data);
      
      // 게임 타이머 복원
      if (data.gameTimerExpiresAt) {
        const expiresAt = new Date(data.gameTimerExpiresAt);
        const now = new Date();
        const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
        
        if (remaining > 0) {
          setGameTimeRemaining(remaining);
          
          if (gameTimerIntervalRef.current) {
            clearInterval(gameTimerIntervalRef.current);
          }
          
          gameTimerIntervalRef.current = setInterval(() => {
            const now = new Date();
            const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
            
            if (remaining <= 0) {
              setGameTimeRemaining(0);
              if (gameTimerIntervalRef.current) {
                clearInterval(gameTimerIntervalRef.current);
              }
            } else {
              setGameTimeRemaining(remaining);
            }
          }, 1000);
        }
      }
      
      // 유예시간 복원
      if (data.gracePeriodExpiresAt && data.firstWinner) {
        const expiresAt = new Date(data.gracePeriodExpiresAt);
        const now = new Date();
        const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
        
        if (remaining > 0) {
          // firstWinner userId를 username으로 변환
          const winnerParticipant = participants.find(p => {
            const userId = typeof p.user === 'object' ? p.user._id : p.user;
            return String(userId) === String(data.firstWinner);
          });
          
          const winnerName = winnerParticipant && typeof winnerParticipant.user === 'object' 
            ? winnerParticipant.user.username 
            : data.firstWinner;
          
          setFirstWinner(winnerName);
          setGracePeriodRemaining(remaining);
          
          if (gracePeriodIntervalRef.current) {
            clearInterval(gracePeriodIntervalRef.current);
          }
          
          gracePeriodIntervalRef.current = setInterval(() => {
            setGracePeriodRemaining(prev => {
              if (prev === null || prev <= 1) {
                if (gracePeriodIntervalRef.current) {
                  clearInterval(gracePeriodIntervalRef.current);
                }
                
                // 유예시간 만료 - 백엔드가 이미 처리하지만 혹시 모를 경우 대비
                console.log('⏰ [ForensicsRush] Grace period expired on client side');
                
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      }
    };

    // 🎯 첫 완료자 알림
    const handleFirstCompletion = (data: { winner: string; gracePeriodMs: number; message: string }) => {
      console.log('🏆 [ForensicsRush] First completion:', data);
      
      // winner가 userId인 경우 username으로 변환
      const winnerParticipant = participants.find(p => {
        const userId = typeof p.user === 'object' ? p.user._id : p.user;
        return String(userId) === String(data.winner);
      });
      
      const winnerName = winnerParticipant && typeof winnerParticipant.user === 'object' 
        ? winnerParticipant.user.username 
        : data.winner;
      
      setFirstWinner(winnerName);
      
      const gracePeriodSeconds = Math.floor(data.gracePeriodMs / 1000);
      setGracePeriodRemaining(gracePeriodSeconds);
      
      if (gracePeriodIntervalRef.current) {
        clearInterval(gracePeriodIntervalRef.current);
      }
      
      gracePeriodIntervalRef.current = setInterval(() => {
        setGracePeriodRemaining(prev => {
          if (prev === null || prev <= 1) {
            if (gracePeriodIntervalRef.current) {
              clearInterval(gracePeriodIntervalRef.current);
            }
            
            // 유예시간 만료 - 백엔드가 이미 처리하지만 혹시 모를 경우 대비
            console.log('⏰ [ForensicsRush] Grace period expired on client side');
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const handleUserCompleted = (data: { userId: string; score: number }) => {
      console.log('✅ [ForensicsRush] User completed:', data);
    };

    const handleAllCompleted = (data: { message: string }) => {
      console.log('🎉 [ForensicsRush] All completed:', data);
      
      if (gracePeriodIntervalRef.current) {
        clearInterval(gracePeriodIntervalRef.current);
      }
      if (gameTimerIntervalRef.current) {
        clearInterval(gameTimerIntervalRef.current);
      }
    };

    const handleTimeExpired = (data: { message: string }) => {
      console.log('⏰ [ForensicsRush] Time expired:', data);
      setGameTimeRemaining(0);
      
      if (gameTimerIntervalRef.current) {
        clearInterval(gameTimerIntervalRef.current);
      }
      if (gracePeriodIntervalRef.current) {
        clearInterval(gracePeriodIntervalRef.current);
      }
    };

    const handleArenaEnded = (data: any) => {
      console.log('🏁 [ForensicsRush] Arena ended, redirecting to results...', data);
      
      if (gameTimerIntervalRef.current) {
        clearInterval(gameTimerIntervalRef.current);
      }
      if (gracePeriodIntervalRef.current) {
        clearInterval(gracePeriodIntervalRef.current);
      }
      
      setTimeout(() => {
        window.location.href = `/arena/${arena._id}/results`;
      }, 2000);
    };

    socket.on('forensics:scenario-data', handleScenarioData);
    socket.on('forensics:questions-data', handleQuestionsData);
    socket.on('forensics:progress-data', handleProgressData);
    socket.on('forensics:result', handleResult);
    socket.on('forensics:submit-failed', handleSubmitFailed);
    socket.on('forensics:error', handleError);
    
    // 🎯 게임 타이머 및 종료 이벤트
    socket.on('forensics:game-state', handleGameState); // 🎯 게임 상태 복원
    socket.on('forensics:game-timer-started', handleGameTimerStarted);
    socket.on('forensics:first-completion', handleFirstCompletion);
    socket.on('forensics:user-completed', handleUserCompleted);
    socket.on('forensics:all-completed', handleAllCompleted);
    socket.on('forensics:time-expired', handleTimeExpired);
    socket.on('arena:ended', handleArenaEnded);

    return () => {
      socket.off('forensics:scenario-data', handleScenarioData);
      socket.off('forensics:questions-data', handleQuestionsData);
      socket.off('forensics:progress-data', handleProgressData);
      socket.off('forensics:result', handleResult);
      socket.off('forensics:submit-failed', handleSubmitFailed);
      socket.off('forensics:error', handleError);
      
      socket.off('forensics:game-state', handleGameState); // 🎯 게임 상태 복원
      socket.off('forensics:game-timer-started', handleGameTimerStarted);
      socket.off('forensics:first-completion', handleFirstCompletion);
      socket.off('forensics:user-completed', handleUserCompleted);
      socket.off('forensics:all-completed', handleAllCompleted);
      socket.off('forensics:time-expired', handleTimeExpired);
      socket.off('arena:ended', handleArenaEnded);
      
      if (gameTimerIntervalRef.current) {
        clearInterval(gameTimerIntervalRef.current);
      }
      if (gracePeriodIntervalRef.current) {
        clearInterval(gracePeriodIntervalRef.current);
      }
    };
  }, [socket, currentQuestionIndex, questions.length, arena._id]);

  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userAnswer.trim() || isSubmitting || allCompleted) return;
    
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setIsSubmitting(true);
    setFeedback(null);

    console.log('📤 [ForensicsRush] Submitting answer:', {
      questionId: currentQuestion.id,
      answer: userAnswer
    });

    socket.emit('forensics:submit', {
      questionId: currentQuestion.id,
      answer: userAnswer
    });
  };

  const getAnsweredQuestion = (questionId: string): AnsweredQuestion | undefined => {
    return answeredQuestions.find(q => q.questionId === questionId);
  };

  const getFileIcon = (type: string): string => {
    const icons: { [key: string]: string } = {
      log: '📄',
      pcap: '📡',
      image: '🖼️',
      memory: '💾',
      registry: '🗂️',
      text: '📝',
      binary: '⚙️',
      database: '🗄️'
    };
    return icons[type] || '📄';
  };

  // username 가져오기
  const getCurrentUsername = () => {
    const participant = participants.find(p => {
      const userId = typeof p.user === 'object' ? p.user._id : p.user;
      return String(userId) === String(currentUserId);
    });
    
    if (participant && typeof participant.user === 'object') {
      return participant.user.username;
    }
    return 'INVESTIGATOR';
  };

  // 🎯 시간 포맷 함수
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentQuestionIndex];
  const isAnswered = currentQuestion ? getAnsweredQuestion(currentQuestion.id)?.correct : false;
  const previousAnswer = currentQuestion ? getAnsweredQuestion(currentQuestion.id) : undefined;
  const relatedEvidenceFiles = currentQuestion
    ? evidenceFiles.filter(file => currentQuestion.relatedFiles?.includes(file.id))
    : [];

  if (isLoading) {
    return (
      <div className="forensics-rush terminal-theme loading">
        <div className="terminal-window">
          <div className="terminal-header">
            <div className="terminal-title">FORENSICS RUSH - LOADING</div>
          </div>
          <div className="terminal-body">
            <div className="loading-content">
              <div className="loading-text">
                $ ./initialize_forensics_suite.sh<span className="blink">_</span>
              </div>
              <div className="loading-detail">
                • Mounting evidence files...
              </div>
              <div className="loading-detail">
                • Initializing forensics tools...
              </div>
              <div className="loading-detail">
                • Loading case scenario...
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="forensics-rush terminal-theme error">
        <div className="terminal-window">
          <div className="terminal-header">
            <div className="terminal-title">ERROR</div>
          </div>
          <div className="terminal-body">
            <div className="error-message">
              ERROR: Failed to load scenario data<br />
              Please refresh the page or contact support
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forensics-rush terminal-theme">
      {/* 터미널 헤더 */}
      <div className="terminal-header">
        <div className="terminal-title-bar">
          <div>
            <span className="terminal-icon">🔒</span>
            <span className="terminal-title">FORENSICS INVESTIGATION TERMINAL</span>
          </div>
          <div className="terminal-controls">
            <div className="control minimize">_</div>
            <div className="control maximize">□</div>
            <div className="control close">×</div>
          </div>
        </div>
        <div className="system-info-bar">
          <div className="info-item">
            USER: <span className="highlight">{getCurrentUsername()}</span>
          </div>
          <div className="info-item">
            STATUS: <span className="status-active">ACTIVE</span>
          </div>
          <div className="info-item">
            SCORE: <span className="highlight">{score}</span>
          </div>
          <div className="info-item">
            PROGRESS: <span className="highlight">{questionsCorrect}/{totalQuestions}</span>
          </div>
          {/* 🎯 게임 타이머 */}
          {gameTimeRemaining !== null && (
            <div className="info-item">
              TIME: <span className={`highlight ${gameTimeRemaining < 60 ? 'warning' : ''}`}>
                {formatTime(gameTimeRemaining)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 시나리오 배너 */}
      <div className="scenario-banner">
        <div className="banner-left">
          <div className="incident-badge">{scenario.incidentType}</div>
          <div className="scenario-info">
            <h2 className="scenario-title">{scenario.title}</h2>
            <p className="scenario-date">{scenario.date}</p>
          </div>
        </div>
      </div>

      {/* 🎯 유예시간 배너 */}
      {gracePeriodRemaining !== null && gracePeriodRemaining > 0 && firstWinner && (
        <div className="grace-period-banner">
          <div className="banner-content">
            <span className="banner-icon">🏆</span>
            <span className="banner-text">
              {firstWinner} completed first!
            </span>
            <span className="banner-timer">
              Grace period: <strong>{formatTime(gracePeriodRemaining)}</strong>
            </span>
          </div>
        </div>
      )}

      {allCompleted ? (
        <div className="completion-screen">
          <div className="terminal-window">
            <div className="terminal-header">
              <div className="terminal-title">INVESTIGATION COMPLETE</div>
            </div>
            <div className="terminal-body">
              <div className="success-message">
                $ ./generate_final_report.sh<br />
                <br />
                ========================================<br />
                INVESTIGATION STATUS: COMPLETE<br />
                ========================================<br />
                <br />
                Final Score: {score} points<br />
                Questions Solved: {questionsCorrect}/{totalQuestions}<br />
                <br />
                Excellent work, investigator!<br />
                All evidence has been analyzed successfully.<br />
                <br />
                Waiting for other participants...<br />
                The arena will end when all complete or time expires.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="forensics-main-grid">
          {/* 증거 파일 터미널 */}
          <div className={`evidence-terminal terminal-window ${evidenceClosed ? 'closed' : ''}`}>
            <div className="terminal-header">
              <div className="terminal-title">EVIDENCE FILES</div>
              <button 
                className="toggle-terminal"
                onClick={() => setEvidenceClosed(!evidenceClosed)}
              >
                {evidenceClosed ? '▶' : '◀'}
              </button>
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
                      <span className="file-perms">-rw-r--r--</span>
                      <span className="file-size">{Math.floor(Math.random() * 900 + 100)}K</span>
                      <span className="file-icon">{getFileIcon(file.type)}</span>
                      <span className="file-name">{file.name}</span>
                      {isRelated && <span className="flag-badge">[!]</span>}
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
                  <div className="hint-header">⚡ ANALYST TIP</div>
                  <div className="hint-content">
                    Related files for current question:
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
                        ✓ SOLVED (Attempts: {previousAnswer?.attempts || 1})
                      </div>
                      {currentQuestionIndex < questions.length - 1 && (
                        <button
                          className="terminal-button next"
                          onClick={() => {
                            setCurrentQuestionIndex(prev => prev + 1);
                            setUserAnswer('');
                            setFeedback(null);
                            setShowHints(false);
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
                            disabled={isSubmitting}
                            autoFocus
                          />
                        </div>
                        
                        <div className="terminal-actions">
                          <button
                            type="submit"
                            className="terminal-button submit"
                            disabled={!userAnswer.trim() || isSubmitting}
                          >
                            {isSubmitting ? '[ANALYZING...]' : '[SUBMIT]'}
                          </button>
                          
                          <button
                            type="button"
                            className="terminal-button hint"
                            onClick={() => setShowHints(!showHints)}
                          >
                            {showHints ? '[HIDE HINTS]' : '[SHOW HINTS]'}
                          </button>
                        </div>
                      </form>

                      {feedback && (
                        <div className={`terminal-feedback ${feedback.type}`}>
                          <span className="feedback-icon">{feedback.type === 'success' ? '✓' : '✗'}</span>
                          {feedback.message}
                        </div>
                      )}

                      {showHints && currentQuestion.hints && currentQuestion.hints.length > 0 && (
                        <div className="hints-terminal">
                          <div className="hints-header">HINTS:</div>
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
                          setShowHints(false);
                        }}
                        title={q.question}
                      >
                        {isCompleted ? '✓' : index + 1}
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