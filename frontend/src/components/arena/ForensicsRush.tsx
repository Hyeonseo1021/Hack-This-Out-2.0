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
  content?: string;  // ✅ 실제 파일 내용
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
  const [showEvidencePanel, setShowEvidencePanel] = useState(true);
  const [allCompleted, setAllCompleted] = useState(false);
  const isInitializedRef = useRef(false);

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

    socket.on('forensics:scenario-data', handleScenarioData);
    socket.on('forensics:questions-data', handleQuestionsData);
    socket.on('forensics:progress-data', handleProgressData);
    socket.on('forensics:result', handleResult);
    socket.on('forensics:submit-failed', handleSubmitFailed);
    socket.on('forensics:error', handleError);

    return () => {
      socket.off('forensics:scenario-data', handleScenarioData);
      socket.off('forensics:questions-data', handleQuestionsData);
      socket.off('forensics:progress-data', handleProgressData);
      socket.off('forensics:result', handleResult);
      socket.off('forensics:submit-failed', handleSubmitFailed);
      socket.off('forensics:error', handleError);
    };
  }, [socket, currentQuestionIndex, questions.length]);

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
      answer: userAnswer.trim()
    });
  };

  const getAnsweredQuestion = (questionId: string): AnsweredQuestion | undefined => {
    return answeredQuestions.find(a => a.questionId === questionId);
  };

  // 현재 유저 이름 가져오기
  const getCurrentUsername = (): string => {
    if (!currentUserId) return 'ANALYST';
    
    const currentParticipant = participants.find(p => {
      if (typeof p.user === 'string') {
        return p.user === currentUserId;
      }
      return p.user._id === currentUserId;
    });

    if (currentParticipant && typeof currentParticipant.user !== 'string') {
      return currentParticipant.user.username;
    }
    
    return 'ANALYST';
  };

  const getFileIcon = (type: string) => {
    const icons: Record<string, string> = {
      'log': '📄',
      'pcap': '📦',
      'memory': '💾',
      'filesystem': '📁',
      'image': '🖼️'
    };
    return icons[type] || '📄';
  };

  if (isLoading) {
    return (
      <div className="forensics-rush terminal-theme loading">
        <div className="terminal-window">
          <div className="terminal-header">
            <span className="terminal-title">FORENSICS_ANALYZER.exe</span>
            <div className="terminal-controls">
              <span className="control minimize">_</span>
              <span className="control maximize">□</span>
              <span className="control close">×</span>
            </div>
          </div>
          <div className="terminal-body">
            <div className="loading-content">
              <pre className="ascii-art">{`
  ███████╗ ██████╗ ██████╗ ███████╗███╗   ██╗███████╗██╗ ██████╗███████╗
  ██╔════╝██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██║██╔════╝██╔════╝
  █████╗  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║███████╗██║██║     ███████╗
  ██╔══╝  ██║   ██║██╔══██╗██╔══╝  ██║╚██╗██║╚════██║██║██║     ╚════██║
  ██║     ╚██████╔╝██║  ██║███████╗██║ ╚████║███████║██║╚██████╗███████║
  ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚══════╝╚═╝ ╚═════╝╚══════╝
              `}</pre>
              <p className="loading-text">
                <span className="blink">▓</span> INITIALIZING FORENSICS SYSTEM...
              </p>
              <p className="loading-detail">Loading evidence files and scenario data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!scenario || questions.length === 0) {
    return (
      <div className="forensics-rush terminal-theme error">
        <div className="terminal-window">
          <div className="terminal-header">
            <span className="terminal-title">ERROR</span>
          </div>
          <div className="terminal-body">
            <pre className="error-message">
{`[ERROR] No scenario available
System Status: FAILED
Error Code: 0x00000404

Please contact the system administrator.`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const previousAnswer = currentQuestion ? getAnsweredQuestion(currentQuestion.id) : null;
  const isAnswered = previousAnswer?.correct || false;
  const progress = totalQuestions > 0 ? (questionsCorrect / totalQuestions) * 100 : 0;
  const relatedEvidenceFiles = currentQuestion 
    ? evidenceFiles.filter(file => currentQuestion.relatedFiles?.includes(file.id))
    : [];

  return (
    <div className="forensics-rush terminal-theme">
      
      {/* 터미널 헤더 */}
      <div className="terminal-header">
        <div className="terminal-title-bar">
          <span className="terminal-icon">⚡</span>
          <span className="terminal-title">FORENSICS_ANALYZER v2.1.0</span>
          <div className="terminal-controls">
            <span className="control minimize">_</span>
            <span className="control maximize">□</span>
            <span className="control close">×</span>
          </div>
        </div>
        <div className="system-info-bar">
          <span className="info-item">USER: {getCurrentUsername()}</span>
          <span className="info-item">SCORE: <span className="highlight">{score}</span></span>
          <span className="info-item">PROGRESS: <span className="highlight">{questionsCorrect}/{totalQuestions}</span></span>
          <span className="info-item">STATUS: <span className="status-active">ACTIVE</span></span>
        </div>
      </div>

      {/* 시나리오 정보 */}
      <div className="scenario-banner">
        <div className="banner-left">
          <div className="incident-badge">{scenario.incidentType.toUpperCase()}</div>
          <div className="scenario-info">
            <h2 className="scenario-title">⚠️ {scenario.title}</h2>
            <p className="scenario-date">{scenario.date}</p>
          </div>
        </div>
        <div className="banner-right">
          <div className="progress-circle">
            <svg width="80" height="80">
              <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(0,255,0,0.1)" strokeWidth="6"/>
              <circle 
                cx="40" cy="40" r="35" fill="none" 
                stroke="#00ff00" strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 35}`}
                strokeDashoffset={`${2 * Math.PI * 35 * (1 - progress / 100)}`}
                transform="rotate(-90 40 40)"
              />
              <text x="40" y="45" textAnchor="middle" fill="#00ff00" fontSize="16" fontFamily="monospace">
                {Math.round(progress)}%
              </text>
            </svg>
          </div>
        </div>
      </div>

      {allCompleted ? (
        <div className="completion-screen">
          <div className="terminal-window">
            <div className="terminal-header">
              <span className="terminal-title">INVESTIGATION_COMPLETE</span>
            </div>
            <div className="terminal-body">
              <pre className="success-message">
{`╔════════════════════════════════════════════════════════╗
║           INVESTIGATION COMPLETED                      ║
╚════════════════════════════════════════════════════════╝

FINAL SCORE: ${score} POINTS
QUESTIONS SOLVED: ${questionsCorrect}/${totalQuestions}
ACCURACY: ${totalQuestions > 0 ? Math.round((questionsCorrect / totalQuestions) * 100) : 0}%

[SUCCESS] All evidence analyzed successfully.
[SUCCESS] Case closed.

System Status: OPERATION COMPLETE`}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        <div className="forensics-main-grid">
          
          {/* 좌측: 증거 파일 패널 */}
          <div className={`evidence-terminal ${showEvidencePanel ? 'open' : 'closed'}`}>
            <div className="terminal-window">
              <div className="terminal-header">
                <span className="terminal-title">EVIDENCE_FILES.db</span>
                <button 
                  className="toggle-terminal"
                  onClick={() => setShowEvidencePanel(!showEvidencePanel)}
                >
                  {showEvidencePanel ? '◀' : '▶'}
                </button>
              </div>

              {showEvidencePanel && (
                <div className="terminal-body">
                  {/* 파일 목록 */}
                  <div className="file-list">
                    <div className="list-header">
                      <span>$ ls -la /evidence/</span>
                    </div>
                    {evidenceFiles.map((file, idx) => {
                      const isRelated = currentQuestion?.relatedFiles?.includes(file.id);
                      const isSelected = selectedEvidenceFile?.id === file.id;
                      
                      return (
                        <div
                          key={file.id}
                          className={`file-item ${isSelected ? 'selected' : ''} ${isRelated ? 'related' : ''}`}
                          onClick={() => setSelectedEvidenceFile(file)}
                        >
                          <span className="file-perms">-rw-r--r--</span>
                          <span className="file-size">{Math.floor(Math.random() * 900 + 100)}KB</span>
                          <span className="file-icon">{getFileIcon(file.type)}</span>
                          <span className="file-name">{file.name}</span>
                          {isRelated && <span className="flag-badge">[RELATED]</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* 파일 뷰어 */}
                  {selectedEvidenceFile && (
                    <div className="file-viewer">
                      <div className="viewer-header">
                        <span>$ cat {selectedEvidenceFile.path}</span>
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

[No content available - File content would be displayed here]

Tip: Use grep, awk, or other forensics tools to analyze this file.
Look for suspicious patterns, IP addresses, and timestamps.`}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* 관련 파일 힌트 */}
                  {relatedEvidenceFiles.length > 0 && (
                    <div className="hint-box">
                      <div className="hint-header">💡 ANALYST TIP:</div>
                      <div className="hint-content">
                        Check these files for this question:
                        <ul>
                          {relatedEvidenceFiles.map(file => (
                            <li key={file.id}>{file.name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 우측: 질문 터미널 */}
          <div className="question-terminal">
            <div className="terminal-window">
              <div className="terminal-header">
                <span className="terminal-title">INVESTIGATION_QUERY.log</span>
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
                              {isSubmitting ? '[ANALYZING...]' : '[SUBMIT ANSWER]'}
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
                            <div className="hints-header">💡 HINTS:</div>
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

                {/* 질문 네비게이션 */}
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
        </div>
      )}
    </div>
  );
};

export default ForensicsRush;