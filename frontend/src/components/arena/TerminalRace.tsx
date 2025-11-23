import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import '../../assets/scss/arena/TerminalRace.scss';

type Participant = {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
  progress?: any;
};

interface TerminalRaceProps {
  arena: { _id: string; mode: string; };
  socket: Socket;
  currentUserId: string | null;
  participants: Participant[];
}

interface TerminalResultData {
  userId: string;
  command: string;
  message: string;
  scoreGain?: number;
  stageAdvanced?: boolean;
  completed?: boolean;
  currentStage?: number;
  totalScore?: number;
}

interface ProgressData {
  stage: number;
  score: number;
  completed: boolean;
  prompt?: string;
  totalStages?: number;
}

interface PromptData {
  prompt: string;
  stage: number;
  totalStages: number;
}

interface LogEntry {
  id: number;
  text: string;
  type: 'prompt' | 'command' | 'output' | 'success' | 'error' | 'system' | 'score';
}

const TerminalRace: React.FC<TerminalRaceProps> = ({
  arena,
  socket,
  currentUserId
}) => {
  const navigate = useNavigate();
  const [command, setCommand] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStage, setCurrentStage] = useState(0);
  const [totalStages, setTotalStages] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [graceTimeRemaining, setGraceTimeRemaining] = useState<number | null>(null);
  const [lastScoreGain, setLastScoreGain] = useState(0);
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitializedRef = useRef(false);
  const isCompletedRef = useRef(false);
  const graceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ 중복 방지를 위한 ref
  const lastProcessedCommandRef = useRef<string>('');
  const lastPromptStageRef = useRef<number>(-1);
  const processingRef = useRef<boolean>(false);

  // 초기 진행 상황 로드
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const loadProgress = async () => {
      try {
        const waitForConnection = () => {
          return new Promise<void>((resolve) => {
            if (socket.connected) resolve();
            else socket.once('connect', () => resolve());
          });
        };
        
        await waitForConnection();
        
        socket.emit('terminal:get-progress', { arenaId: arena._id });
        setTimeout(() => socket.emit('terminal:get-prompt', { arenaId: arena._id }), 500);
        setTimeout(() => setIsLoading(false), 1500);

      } catch (error) {
        console.error('Failed to load progress:', error);
        setLogs([{ id: logCounter.current++, text: 'Failed to load scenario.', type: 'error' }]);
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [socket, arena._id]);

  // ✅ 이벤트 핸들러들을 useCallback으로 메모이제이션
  const handleProgressData = useCallback((data: ProgressData) => {
    const { stage, score, completed, totalStages: total } = data;
    
    setCurrentStage(stage);
    setCurrentScore(score);
    setIsCompleted(completed);
    isCompletedRef.current = completed;
    if (total) setTotalStages(total);

    const initialLogs: LogEntry[] = [
      { id: logCounter.current++, text: '╔═══════════════════════════════════════════════╗', type: 'system' },
      { id: logCounter.current++, text: '║         TERMINAL HACKING RACE - MISSION       ║', type: 'system' },
      { id: logCounter.current++, text: '╚═══════════════════════════════════════════════╝', type: 'system' },
      { id: logCounter.current++, text: '', type: 'output' }
    ];

    if (completed) {
      initialLogs.push(
        { id: logCounter.current++, text: '🎉 MISSION ACCOMPLISHED!', type: 'success' },
        { id: logCounter.current++, text: `Final Score: ${score} points`, type: 'success' }
      );
    }

    setLogs(initialLogs);
    setIsLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handlePromptData = useCallback((data: PromptData) => {
    
    if (lastPromptStageRef.current === data.stage) {
      console.log('⏭️ [TerminalRace] Duplicate prompt detected, ignoring');
      return;
    }
    lastPromptStageRef.current = data.stage;

    const newLogs: LogEntry[] = [
      { id: logCounter.current++, text: '', type: 'output' },
      { id: logCounter.current++, text: '━'.repeat(50), type: 'system' },
      { id: logCounter.current++, text: `STAGE ${data.stage}/${data.totalStages}`, type: 'system' },
      { id: logCounter.current++, text: '━'.repeat(50), type: 'system' },
      { id: logCounter.current++, text: '', type: 'output' },
      { id: logCounter.current++, text: `OBJECTIVE: ${data.prompt}`, type: 'prompt' },
      { id: logCounter.current++, text: '', type: 'output' }
    ];

    setLogs(prev => [...prev, ...newLogs]);
    setCurrentStage(data.stage - 1);
    setTotalStages(data.totalStages);
  }, []);

  const handleTerminalResult = useCallback((data: TerminalResultData) => {

    if (data.userId !== currentUserId) {
      console.log('⏭️ [TerminalRace] Not my result');
      return;
    }
    
    if (isCompletedRef.current && !data.completed) {
      console.log('⏭️ [TerminalRace] Already completed');
      return;
    }

    // ✅ 중복 처리 방지
    const commandKey = `${data.command}-${data.message}-${data.scoreGain}`;
    if (processingRef.current || lastProcessedCommandRef.current === commandKey) {
      console.log('⏭️ [TerminalRace] Duplicate result detected, ignoring');
      return;
    }
    
    processingRef.current = true;
    lastProcessedCommandRef.current = commandKey;

    const newLogs: LogEntry[] = [];
    const isDefaultResponse = !data.scoreGain || data.scoreGain === 0;
    
    if (isDefaultResponse) {
      newLogs.push({ id: logCounter.current++, text: data.message, type: 'output' });
    } else {
      newLogs.push({ id: logCounter.current++, text: data.message, type: 'success' });
      
      setLastScoreGain(data.scoreGain || 0);
      setTimeout(() => setLastScoreGain(0), 1500);
      
      newLogs.push({ 
        id: logCounter.current++, 
        text: `+${data.scoreGain} points earned!`,
        type: 'score'
      });
      
      if (data.totalScore !== undefined) {
        console.log('💰 [TerminalRace] Updating score to:', data.totalScore);
        setCurrentScore(data.totalScore);
      }
      
      if (data.stageAdvanced && !data.completed) {
        newLogs.push({ 
          id: logCounter.current++, 
          text: `🎯 Stage ${data.currentStage} completed!`,
          type: 'success'
        });
        
        setCurrentStage(data.currentStage || 0);
        
        // 다음 프롬프트 요청
        setTimeout(() => {
          socket.emit('terminal:get-prompt', { arenaId: arena._id });
        }, 1000);
      }
    }

    if (data.completed && !isCompletedRef.current) {
      newLogs.push(
        { id: logCounter.current++, text: '', type: 'output' },
        { id: logCounter.current++, text: '═'.repeat(50), type: 'system' },
        { id: logCounter.current++, text: '🏆 ALL STAGES COMPLETED! 🏆', type: 'success' },
        { id: logCounter.current++, text: `Final Score: ${data.totalScore} points`, type: 'success' },
        { id: logCounter.current++, text: '═'.repeat(50), type: 'system' }
      );
      
      setIsCompleted(true);
      isCompletedRef.current = true;
      if (data.totalScore !== undefined) setCurrentScore(data.totalScore);
    }

    setLogs(prev => [...prev, ...newLogs]);
    setIsSubmitting(false);
    
    // ✅ 처리 완료 후 플래그 리셋
    setTimeout(() => {
      processingRef.current = false;
      inputRef.current?.focus();
    }, 100);
  }, [currentUserId, socket, arena._id]);

  const handleGracePeriodStarted = useCallback((data: { graceMs: number; graceSec: number; message: string }) => {
    if (graceIntervalRef.current) {
      clearInterval(graceIntervalRef.current);
      graceIntervalRef.current = null;
    }
    
    if (!isCompletedRef.current) {
      setLogs(prev => [
        ...prev,
        { id: logCounter.current++, text: '', type: 'output' },
        { id: logCounter.current++, text: '⚠️ '.repeat(25), type: 'system' },
        { id: logCounter.current++, text: `⏰ ${data.message}`, type: 'system' },
        { id: logCounter.current++, text: '⚠️ '.repeat(25), type: 'system' }
      ]);
      
      setGraceTimeRemaining(data.graceSec);
      graceIntervalRef.current = setInterval(() => {
        setGraceTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
            if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, []);

  const handleArenaEnded = useCallback((data: { message: string }) => {
    if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
    setLogs(prev => [
      ...prev,
      { id: logCounter.current++, text: '', type: 'output' },
      { id: logCounter.current++, text: '═'.repeat(50), type: 'system' },
      { id: logCounter.current++, text: '🏁 GAME OVER 🏁', type: 'system' },
      { id: logCounter.current++, text: data.message, type: 'system' },
      { id: logCounter.current++, text: '═'.repeat(50), type: 'system' }
    ]);
    setGraceTimeRemaining(null);
  }, []);

  const handleRedirectToResults = useCallback((data: { redirectUrl: string }) => {
    setTimeout(() => navigate(data.redirectUrl), 500);
  }, [navigate]);

  const handleTerminalError = useCallback((data: { message: string }) => {
    setLogs(prev => [...prev, { id: logCounter.current++, text: `❌ ${data.message}`, type: 'error' }]);
    setIsSubmitting(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Socket 이벤트 리스너 등록 (한 번만!)
  useEffect(() => {
    
    // ✅ 완전히 제거
    socket.off('terminal:progress-data');
    socket.off('terminal:prompt-data');
    socket.off('terminal:result');
    socket.off('terminal:error');
    socket.off('arena:grace-period-started');
    socket.off('arena:ended');
    socket.off('arena:redirect-to-results');

    // ✅ 새로 등록
    socket.on('terminal:progress-data', handleProgressData);
    socket.on('terminal:prompt-data', handlePromptData);
    socket.on('terminal:result', handleTerminalResult);
    socket.on('terminal:error', handleTerminalError);
    socket.on('arena:grace-period-started', handleGracePeriodStarted);
    socket.on('arena:ended', handleArenaEnded);
    socket.on('arena:redirect-to-results', handleRedirectToResults);


    return () => {
      if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
      
      socket.off('terminal:progress-data', handleProgressData);
      socket.off('terminal:prompt-data', handlePromptData);
      socket.off('terminal:result', handleTerminalResult);
      socket.off('terminal:error', handleTerminalError);
      socket.off('arena:grace-period-started', handleGracePeriodStarted);
      socket.off('arena:ended', handleArenaEnded);
      socket.off('arena:redirect-to-results', handleRedirectToResults);
    };
  }, [socket, handleProgressData, handlePromptData, handleTerminalResult, handleTerminalError, 
      handleGracePeriodStarted, handleArenaEnded, handleRedirectToResults]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmitCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isSubmitting || isCompleted) return;

    console.log('📤 [TerminalRace] Submitting command:', command);
    
    setIsSubmitting(true);
    setLogs(prev => [
      ...prev,
      { id: logCounter.current++, text: `root@target:~$ ${command}`, type: 'command' }
    ]);

    socket.emit('terminal:execute', { arenaId: arena._id, command: command.trim() });
    setCommand('');
  };

  const getProgressPercentage = () => {
    if (!totalStages) return 0;
    return ((currentStage + 1) / totalStages) * 100;
  };

  return (
    <div className="terminal-race-container">
      <div className="terminal-header">
        <div className="terminal-header-left">
          <div className="terminal-title">
            <h2>TERMINAL RACE</h2>
          </div>
          <p className="terminal-subtitle">Execute commands to complete the mission</p>
        </div>
        
        <div className="terminal-header-right">
          {!isLoading && (
            <>
              <div className="stat-card stage-card">
                <div className="stat-icon">🎯</div>
                <div className="stat-content">
                  <span className="stat-label">STAGE</span>
                  <span className="stat-value">
                    {isCompleted ? totalStages : currentStage + 1}/{totalStages || '?'}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${getProgressPercentage()}%` }} />
                </div>
              </div>

              <div className={`stat-card score-card ${lastScoreGain > 0 ? 'score-pulse' : ''}`}>
                <div className="stat-icon">⭐</div>
                <div className="stat-content">
                  <span className="stat-label">SCORE</span>
                  <span className="stat-value score-value">
                    {currentScore}
                    {lastScoreGain > 0 && <span className="score-gain">+{lastScoreGain}</span>}
                  </span>
                </div>
              </div>

              {graceTimeRemaining !== null && !isCompleted && (
                <div className="stat-card grace-card">
                  <div className="stat-icon warning">⏰</div>
                  <div className="stat-content">
                    <span className="stat-label">TIME LEFT</span>
                    <span className="stat-value warning">{graceTimeRemaining}s</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="terminal-loading-container">
          <div className="loading-spinner"></div>
          <p>Initializing terminal...</p>
          <div className="loading-dots"><span></span><span></span><span></span></div>
        </div>
      ) : (
        <>
          <div className="terminal-output" ref={logContainerRef}>
            {logs.map(log => (
              <div key={log.id} className={`terminal-line ${log.type}`}>
                {log.type === 'command' && <span className="command-text"><span className="command-icon">▶</span> {log.text}</span>}
                {log.type === 'system' && <span className="system-text">{log.text}</span>}
                {log.type === 'prompt' && <span className="prompt-text"><span className="prompt-icon">🎯</span> {log.text}</span>}
                {log.type === 'score' && <span className="score-text"><span className="score-icon">✨</span> {log.text}</span>}
                {log.type === 'success' && <span className="success-text"><span className="success-icon">✓</span> {log.text}</span>}
                {log.type === 'error' && <span className="error-text"><span className="error-icon">✗</span> {log.text}</span>}
                {log.type === 'output' && <span>{log.text}</span>}
              </div>
            ))}
            {isSubmitting && (
              <div className="terminal-line output">
                <span className="loading-indicator">
                  <span className="spinner-dots"><span></span><span></span><span></span></span>
                  Processing...
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitCommand} className="terminal-input-area">
            <div className="input-wrapper">
              <span className="terminal-prompt">
                <span className="prompt-user">root</span>
                <span className="prompt-separator">@</span>
                <span className="prompt-host">target</span>
                <span className="prompt-path">:~$</span>
              </span>
              <input
                ref={inputRef}
                type="text"
                className="terminal-input"
                placeholder={isCompleted ? "Mission complete!" : "Enter command..."}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmitCommand(e as any))}
                disabled={isSubmitting || isCompleted}
                autoFocus
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              className={`terminal-submit-btn ${isSubmitting ? 'submitting' : ''} ${isCompleted ? 'completed' : ''}`}
              disabled={isSubmitting || !command.trim() || isCompleted}
            >
              {isSubmitting ? <><span className="btn-spinner"></span> RUNNING</> : isCompleted ? <>✔ DONE</> : <>▶ EXECUTE</>}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default TerminalRace;