import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  scenario?: {
    title: { ko: string; en: string } | string;
    description: { ko: string; en: string } | string;
    difficulty: string;
  } | null;
}

interface TerminalResultData {
  userId: string;
  command: string;
  message: string | { ko: string; en: string };
  scoreGain?: number;
  baseScore?: number;
  stageAdvanced?: boolean;
  completed?: boolean;
  currentStage?: number;
  totalScore?: number;
}

interface ProgressData {
  stage: number;
  score: number;
  completed: boolean;
  prompt?: string | { ko: string; en: string };
  totalStages?: number;
  graceTimeRemaining?: number | null;
  totalGraceTime?: number | null;
}

interface PromptData {
  prompt: string | { ko: string; en: string };
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
  currentUserId,
  scenario
}) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('arena');

  // Helper function to extract bilingual text
  const getBilingualText = (text: string | { ko: string; en: string } | undefined): string => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    const lang = i18n.language as 'ko' | 'en';
    return text[lang] || text.ko || text.en;
  };
  const [command, setCommand] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStage, setCurrentStage] = useState(0);
  const [totalStages, setTotalStages] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [graceTimeRemaining, setGraceTimeRemaining] = useState<number | null>(null);
  const [totalGraceTime, setTotalGraceTime] = useState<number | null>(null);
  const [lastScoreGain, setLastScoreGain] = useState(0);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const logCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitializedRef = useRef(false);
  const isCompletedRef = useRef(false);
  const graceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const lastProcessedCommandRef = useRef<string>('');
  const lastPromptStageRef = useRef<number>(-1);
  const processingRef = useRef<boolean>(false);

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
        setLogs([{ id: logCounter.current++, text: '[ERROR] Failed to load scenario', type: 'error' }]);
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [socket, arena._id]);

  const handleProgressData = useCallback((data: ProgressData) => {
    const { stage, score, completed, totalStages: total, graceTimeRemaining, totalGraceTime } = data;

    setCurrentStage(stage);
    setCurrentScore(score);
    setIsCompleted(completed);
    isCompletedRef.current = completed;
    if (total) setTotalStages(total);

    const initialLogs: LogEntry[] = [
      { id: logCounter.current++, text: '[SYSTEM] Terminal Hacking Race', type: 'system' },
      { id: logCounter.current++, text: '[SYSTEM] Mission initialized', type: 'system' },
      { id: logCounter.current++, text: '', type: 'output' }
    ];

    if (completed) {
      initialLogs.push(
        { id: logCounter.current++, text: '[SUCCESS] MISSION ACCOMPLISHED', type: 'success' },
        { id: logCounter.current++, text: `[INFO] Final Score: ${score} points`, type: 'success' }
      );
    }

    // ✅ 유예시간 복원 (새로고침 시)
    if (graceTimeRemaining && totalGraceTime && !completed) {
      const graceMin = Math.floor(graceTimeRemaining / 60);
      const graceSecRemainder = graceTimeRemaining % 60;
      const graceTimeFormatted = graceMin > 0
        ? `${graceMin}:${String(graceSecRemainder).padStart(2, '0')}`
        : `${graceTimeRemaining}s`;

      initialLogs.push(
        { id: logCounter.current++, text: '', type: 'output' },
        { id: logCounter.current++, text: `[WARNING] First player completed! You have ${graceTimeFormatted} to finish.`, type: 'error' },
        { id: logCounter.current++, text: '', type: 'output' }
      );

      setTotalGraceTime(totalGraceTime);
      setGraceTimeRemaining(graceTimeRemaining);

      // 기존 타이머 정리
      if (graceIntervalRef.current) {
        clearInterval(graceIntervalRef.current);
      }

      graceIntervalRef.current = setInterval(() => {
        setGraceTimeRemaining(prev => {
          if (prev === null || prev <= 0) {
            if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }

    setLogs(initialLogs);
    setIsLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handlePromptData = useCallback((data: PromptData) => {

    if (lastPromptStageRef.current === data.stage) {
      console.log('[DEBUG] Duplicate prompt detected, ignoring');
      return;
    }
    lastPromptStageRef.current = data.stage;

    const promptText = getBilingualText(data.prompt);

    const newLogs: LogEntry[] = [
      { id: logCounter.current++, text: '', type: 'output' },
      { id: logCounter.current++, text: `[STAGE ${data.stage}/${data.totalStages}]`, type: 'system' },
      { id: logCounter.current++, text: promptText, type: 'prompt' },
      { id: logCounter.current++, text: '', type: 'output' }
    ];

    setLogs(prev => [...prev, ...newLogs]);
    setCurrentStage(data.stage - 1);
    setTotalStages(data.totalStages);
  }, []);

  const handleTerminalResult = useCallback((data: TerminalResultData) => {

    if (data.userId !== currentUserId) {
      console.log('[DEBUG] Not my result');
      return;
    }

    if (isCompletedRef.current && !data.completed) {
      console.log('[DEBUG] Already completed');
      return;
    }

    const commandKey = `${data.command}-${data.message}-${data.scoreGain}`;
    if (processingRef.current || lastProcessedCommandRef.current === commandKey) {
      console.log('[DEBUG] Duplicate result detected, ignoring');
      return;
    }

    processingRef.current = true;
    lastProcessedCommandRef.current = commandKey;

    const messageText = getBilingualText(data.message);

    const newLogs: LogEntry[] = [];
    const isDefaultResponse = !data.scoreGain || data.scoreGain === 0;

    if (isDefaultResponse) {
      newLogs.push({ id: logCounter.current++, text: messageText, type: 'output' });
    } else {
      newLogs.push({ id: logCounter.current++, text: `[SUCCESS] ${messageText}`, type: 'success' });

      setLastScoreGain(data.scoreGain || 0);
      setTimeout(() => setLastScoreGain(0), 1500);

      // 부스트 적용 여부 확인
      const hasBoost = data.baseScore && data.scoreGain && data.scoreGain > data.baseScore;

      newLogs.push({
        id: logCounter.current++,
        text: hasBoost
          ? `[+${data.scoreGain} POINTS]`
          : `[+${data.scoreGain} POINTS]`,
        type: 'score'
      });

      if (data.totalScore !== undefined) {
        console.log('[DEBUG] Updating score to:', data.totalScore);
        setCurrentScore(data.totalScore);
      }

      if (data.stageAdvanced && !data.completed) {
        newLogs.push({
          id: logCounter.current++,
          text: `[STAGE ${data.currentStage} COMPLETED]`,
          type: 'success'
        });

        setCurrentStage(data.currentStage || 0);

        setTimeout(() => {
          socket.emit('terminal:get-prompt', { arenaId: arena._id });
        }, 1000);
      }
    }

    if (data.completed && !isCompletedRef.current) {
      newLogs.push(
        { id: logCounter.current++, text: '', type: 'output' },
        { id: logCounter.current++, text: '[MISSION COMPLETE] All stages accomplished', type: 'success' },
        { id: logCounter.current++, text: `[FINAL SCORE] ${data.totalScore} points`, type: 'success' },
        { id: logCounter.current++, text: '[INFO] Waiting for other players...', type: 'system' },
        { id: logCounter.current++, text: '', type: 'output' }
      );

      setIsCompleted(true);
      isCompletedRef.current = true;
      if (data.totalScore !== undefined) setCurrentScore(data.totalScore);
    }

    setLogs(prev => [...prev, ...newLogs]);
    setIsSubmitting(false);

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
        { id: logCounter.current++, text: `[WARNING] ${data.message}`, type: 'error' },
        { id: logCounter.current++, text: '', type: 'output' }
      ]);

      setTotalGraceTime(data.graceSec);
      setGraceTimeRemaining(data.graceSec);
      graceIntervalRef.current = setInterval(() => {
        setGraceTimeRemaining(prev => {
          if (prev === null || prev <= 0) {
            if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, []);

  const arenaEndedRef = useRef(false);

  const handleArenaEnded = useCallback((data: { message: string }) => {
    if (arenaEndedRef.current) return;
    arenaEndedRef.current = true;

    if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
    setLogs(prev => [
      ...prev,
      { id: logCounter.current++, text: '', type: 'output' },
      { id: logCounter.current++, text: '[GAME OVER]', type: 'system' },
      { id: logCounter.current++, text: `[INFO] ${data.message}`, type: 'system' },
      { id: logCounter.current++, text: '', type: 'output' }
    ]);
    setGraceTimeRemaining(null);
  }, []);

  const handleRedirectToResults = useCallback((data: { redirectUrl: string }) => {
    setTimeout(() => navigate(data.redirectUrl), 500);
  }, [navigate]);

  const handleTerminalError = useCallback((data: { message: string }) => {
    setLogs(prev => [...prev, { id: logCounter.current++, text: `[ERROR] ${data.message}`, type: 'error' }]);
    setIsSubmitting(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleItemUsed = useCallback((data: {
    userId: string;
    username: string;
    itemType: string;
    value: number;
    message: string | { ko: string; en: string }
  }) => {
    const msg = typeof data.message === 'object'
      ? (i18n.language === 'ko' ? data.message.ko : data.message.en)
      : data.message;

    setLogs(prev => [
      ...prev,
      { id: logCounter.current++, text: `[SYSTEM] ${msg}`, type: 'system' }
    ]);
  }, [i18n.language]);

  useEffect(() => {

    socket.off('terminal:progress-data');
    socket.off('terminal:prompt-data');
    socket.off('terminal:result');
    socket.off('terminal:error');
    socket.off('arena:grace-period-started');
    socket.off('arena:ended');
    socket.off('arena:redirect-to-results');
    socket.off('arena:item-used');

    socket.on('terminal:progress-data', handleProgressData);
    socket.on('terminal:prompt-data', handlePromptData);
    socket.on('terminal:result', handleTerminalResult);
    socket.on('terminal:error', handleTerminalError);
    socket.on('arena:grace-period-started', handleGracePeriodStarted);
    socket.on('arena:ended', handleArenaEnded);
    socket.on('arena:redirect-to-results', handleRedirectToResults);
    socket.on('arena:item-used', handleItemUsed);


    return () => {
      if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
      arenaEndedRef.current = false;

      socket.off('terminal:progress-data', handleProgressData);
      socket.off('terminal:prompt-data', handlePromptData);
      socket.off('terminal:result', handleTerminalResult);
      socket.off('terminal:error', handleTerminalError);
      socket.off('arena:grace-period-started', handleGracePeriodStarted);
      socket.off('arena:ended', handleArenaEnded);
      socket.off('arena:redirect-to-results', handleRedirectToResults);
      socket.off('arena:item-used', handleItemUsed);
    };
  }, [socket, handleProgressData, handlePromptData, handleTerminalResult, handleTerminalError,
      handleGracePeriodStarted, handleArenaEnded, handleRedirectToResults, handleItemUsed]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmitCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isSubmitting || isCompleted) return;

    console.log('[SUBMIT] Command:', command);

    setIsSubmitting(true);
    setLogs(prev => [
      ...prev,
      { id: logCounter.current++, text: command, type: 'command' }
    ]);

    socket.emit('terminal:execute', { arenaId: arena._id, command: command.trim() });
    setCommand('');
  };

  return (
    <div className="terminal-race-container">
      {/* Scenario Info Header */}
      {scenario && (
        <div className="scenario-info-bar">
          <div className="scenario-main">
            <div className="scenario-details">
              <h3 className="scenario-title">
                {typeof scenario.title === 'object'
                  ? (scenario.title as any)[i18n.language] || (scenario.title as any).ko || (scenario.title as any).en
                  : scenario.title}
              </h3>
              <p className="scenario-description">
                {typeof scenario.description === 'object'
                  ? (scenario.description as any)[i18n.language] || (scenario.description as any).ko || (scenario.description as any).en
                  : scenario.description}
              </p>
            </div>
          </div>
          <div className="scenario-meta">
            <span className={`difficulty-badge difficulty-${scenario.difficulty?.toLowerCase()}`}>
              {scenario.difficulty}
            </span>
          </div>
        </div>
      )}

      {/* Terminal Window */}
      <div className="terminal-window">
        {/* Terminal Title Bar */}
        <div className="terminal-title-bar">
          <div className="terminal-controls">
            <span className="control-btn close"></span>
            <span className="control-btn minimize"></span>
            <span className="control-btn maximize"></span>
          </div>
          <div className="terminal-title-text">root@hackthisout:~</div>
          <div className="terminal-stats">
            {!isLoading && (
              <>
                <span className="stat-item">
                  Stage {isCompleted ? totalStages : currentStage + 1}/{totalStages || '?'}
                </span>
                <span className={`stat-item ${lastScoreGain > 0 ? 'score-pulse' : ''}`}>
                  {currentScore} points
                  {lastScoreGain > 0 && <span className="score-popup">+{lastScoreGain}</span>}
                </span>
                {graceTimeRemaining !== null && totalGraceTime !== null && !isCompleted && (
                  <span className="stat-item warning-stat">
                    {Math.floor(graceTimeRemaining / 60)}:{String(graceTimeRemaining % 60).padStart(2, '0')}/{Math.floor(totalGraceTime / 60)}:{String(totalGraceTime % 60).padStart(2, '0')}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Terminal Body */}
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
                  {log.type === 'command' && <span className="command-text">{log.text}</span>}
                  {log.type === 'system' && <span className="system-text">{log.text}</span>}
                  {log.type === 'prompt' && <span className="prompt-text">{log.text}</span>}
                  {log.type === 'score' && <span className="score-text">{log.text}</span>}
                  {log.type === 'success' && <span className="success-text">{log.text}</span>}
                  {log.type === 'error' && <span className="error-text">{log.text}</span>}
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
                  <span className="prompt-host">hackthisout</span>
                  <span className="prompt-path">:~$</span>
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  className="terminal-input"
                  placeholder={isCompleted ? t('game.missionComplete') : t('game.enterCommand')}
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
                {isSubmitting ? <><span className="btn-spinner"></span> RUNNING</> : isCompleted ? <>DONE</> : <>EXECUTE</>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default TerminalRace;
