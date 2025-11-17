import React, { useState, useEffect, useRef } from 'react';
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
  type: 'prompt' | 'command' | 'output' | 'success' | 'error' | 'system';
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
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitializedRef = useRef(false);
  const isCompletedRef = useRef(false);
  const graceIntervalRef = useRef<NodeJS.Timeout | null>(null); // ✅ interval ref

  // 초기 진행 상황 로드
  useEffect(() => {
    if (isInitializedRef.current) {
      console.log('⏭️ [TerminalRace] Already initialized, skipping...');
      return;
    }
    isInitializedRef.current = true;

    const loadProgress = async () => {
      try {
        console.log('📡 [TerminalRace] Loading progress...');
        console.log('📡 [TerminalRace] Socket connected:', socket.connected);
        console.log('📡 [TerminalRace] Arena ID:', arena._id);
        console.log('📡 [TerminalRace] Current User ID:', currentUserId);
        
        // ✅ Socket이 연결될 때까지 대기
        const waitForConnection = () => {
          return new Promise<void>((resolve) => {
            if (socket.connected) {
              resolve();
            } else {
              socket.once('connect', () => resolve());
            }
          });
        };
        
        await waitForConnection();
        console.log('✅ [TerminalRace] Socket connected, proceeding...');
        
        socket.emit('terminal:get-progress', { arenaId: arena._id });

        setTimeout(() => {
          console.log('📡 [TerminalRace] Requesting initial prompt...');
          socket.emit('terminal:get-prompt', { arenaId: arena._id });
        }, 500);

        setTimeout(() => {
          setIsLoading(false);
        }, 1500);

      } catch (error) {
        console.error('Failed to load progress:', error);
        setLogs([
          { id: logCounter.current++, text: 'Failed to load scenario. Please refresh.', type: 'error' }
        ]);
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [arena._id, socket, currentUserId]);

  // 서버 이벤트 수신
  useEffect(() => {
    const handleProgressData = (data: ProgressData) => {
      console.log('📊 [TerminalRace] Progress data received:', data);
      const { stage, score, completed, totalStages: total } = data;
      
      setCurrentStage(stage);
      setCurrentScore(score);
      setIsCompleted(completed);
      isCompletedRef.current = completed;
      if (total) setTotalStages(total);

      const initialLogs: LogEntry[] = [
        { id: logCounter.current++, text: '╔═══════════════════════════════════════════════╗', type: 'system' },
        { id: logCounter.current++, text: '║          TERMINAL HACKING RACE - MISSION          ║', type: 'system' },
        { id: logCounter.current++, text: '╚═══════════════════════════════════════════════╝', type: 'system' },
        { id: logCounter.current++, text: '', type: 'output' }
      ];

      if (completed) {
        initialLogs.push(
          { id: logCounter.current++, text: '🎉 MISSION ACCOMPLISHED! 🎉', type: 'success' },
          { id: logCounter.current++, text: `Final Score: ${score} points`, type: 'success' },
          { id: logCounter.current++, text: '', type: 'output' }
        );
      }

      setLogs(initialLogs);
      setIsLoading(false);
      
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handlePromptData = (data: PromptData) => {
      console.log('📨 [TerminalRace] Received prompt data:', data);

      setLogs(prev => {
        const filtered = prev.filter(
          log =>
            !log.text.includes("Stage") &&
            !log.text.includes("MISSION:") &&
            !log.text.startsWith("─")
        );
        return filtered;
      });

      const newLogs: LogEntry[] = [
        { id: logCounter.current++, text: '', type: 'output' },
        { id: logCounter.current++, text: '─'.repeat(50), type: 'system' },
        { id: logCounter.current++, text: `📍 Stage ${data.stage}/${data.totalStages}`, type: 'system' },
        { id: logCounter.current++, text: '─'.repeat(50), type: 'system' },
        { id: logCounter.current++, text: '', type: 'output' },
        { id: logCounter.current++, text: `🎯 MISSION: ${data.prompt}`, type: 'output' },
        { id: logCounter.current++, text: '', type: 'output' }
      ];

      setLogs(prev => [...prev, ...newLogs]);
      setCurrentStage(data.stage - 1);
      setTotalStages(data.totalStages);
    };

    const handleTerminalResult = (data: TerminalResultData) => {
      console.log('✅ [TerminalRace] Terminal result received:', data);
      
      if (data.userId !== currentUserId) {
        console.log('⏭️ [TerminalRace] Ignoring result from other user');
        return;
      }

      const newLogs: LogEntry[] = [];
      
      if (data.message && !data.completed) {
        newLogs.push({
          id: logCounter.current++,
          text: data.message,
          type: data.scoreGain && data.scoreGain > 0 ? 'success' : 'output'
        });
      }

      if (data.scoreGain && data.scoreGain > 0 && !data.completed) {
        newLogs.push({ 
          id: logCounter.current++, 
          text: `✨ +${data.scoreGain} points earned!`,
          type: 'success'
        });
      }

      if (data.stageAdvanced && !data.completed) {
        newLogs.push(
          { id: logCounter.current++, text: '', type: 'output' },
          { id: logCounter.current++, text: '🎯 Stage Complete! Advancing...', type: 'success' },
          { id: logCounter.current++, text: '', type: 'output' }
        );
        
        if (data.currentStage !== undefined) {
          setCurrentStage(data.currentStage);
        }
        
        setTimeout(() => {
          console.log('📤 [TerminalRace] Requesting new stage prompt...');
          socket.emit('terminal:get-prompt', { arenaId: arena._id });
        }, 500);
      }

      if (data.completed) {
        newLogs.push(
          { id: logCounter.current++, text: '', type: 'output' },
          { id: logCounter.current++, text: '═'.repeat(50), type: 'system' },
          { id: logCounter.current++, text: '🏆 ALL MISSIONS COMPLETE! 🏆', type: 'success' },
          { id: logCounter.current++, text: `🎉 Final Score: ${data.totalScore || 0} points`, type: 'success' },
          { id: logCounter.current++, text: '═'.repeat(50), type: 'system' },
          { id: logCounter.current++, text: '', type: 'output' }
        );
        setIsCompleted(true);
        isCompletedRef.current = true;
      }

      if (data.totalScore !== undefined) {
        setCurrentScore(data.totalScore);
      }

      setLogs(prev => [...prev, ...newLogs]);
      setIsSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    // ✅ 유예 시간 시작 핸들러
    const handleGracePeriodStarted = (data: { graceMs: number; graceSec: number; message: string }) => {
      console.log('⏳ [TerminalRace] Grace period started:', data);
      console.log('⏳ [TerminalRace] isCompletedRef.current:', isCompletedRef.current);
      
      // ✅ 기존 interval 정리
      if (graceIntervalRef.current) {
        console.log('⚠️ [TerminalRace] Clearing existing grace interval');
        clearInterval(graceIntervalRef.current);
        graceIntervalRef.current = null;
      }
      
      if (!isCompletedRef.current) {
        setLogs(prev => [
          ...prev,
          { id: logCounter.current++, text: '', type: 'output' },
          { id: logCounter.current++, text: '⚠️ '.repeat(25), type: 'system' },
          { id: logCounter.current++, text: `⏰ ${data.message}`, type: 'system' },
          { id: logCounter.current++, text: '⚠️ '.repeat(25), type: 'system' },
          { id: logCounter.current++, text: '', type: 'output' }
        ]);
        
        setGraceTimeRemaining(data.graceSec);
        
        // ✅ interval을 ref에 저장
        graceIntervalRef.current = setInterval(() => {
          setGraceTimeRemaining(prev => {
            if (prev === null || prev <= 1) {
              if (graceIntervalRef.current) {
                clearInterval(graceIntervalRef.current);
                graceIntervalRef.current = null;
              }
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
    };

    const handleArenaEnded = (data: { arenaId: string; winner: any; message: string }) => {
      console.log('🏁 [TerminalRace] Arena ended:', data);
      
      // ✅ interval 정리
      if (graceIntervalRef.current) {
        clearInterval(graceIntervalRef.current);
        graceIntervalRef.current = null;
      }
      
      setLogs(prev => [
        ...prev,
        { id: logCounter.current++, text: '', type: 'output' },
        { id: logCounter.current++, text: '═'.repeat(50), type: 'system' },
        { id: logCounter.current++, text: '🏁 GAME OVER 🏁', type: 'system' },
        { id: logCounter.current++, text: data.message, type: 'system' },
        { id: logCounter.current++, text: '═'.repeat(50), type: 'system' },
        { id: logCounter.current++, text: '', type: 'output' }
      ]);
      
      setGraceTimeRemaining(null);
    };

    const handleRedirectToResults = (data: { arenaId: string; redirectUrl: string }) => {
      console.log('🔄 [TerminalRace] Redirecting to results:', data);
      setTimeout(() => navigate(data.redirectUrl), 500);
    };

    const handleTerminalError = (data: { message: string }) => {
      console.error('❌ [TerminalRace] Error:', data.message);
      setLogs(prev => [...prev, {
        id: logCounter.current++,
        text: `❌ ${data.message}`,
        type: 'error'
      }]);
      setIsSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    socket.on('terminal:progress-data', handleProgressData);
    socket.on('terminal:prompt-data', handlePromptData);
    socket.on('terminal:result', handleTerminalResult);
    socket.on('terminal:error', handleTerminalError);
    socket.on('arena:grace-period-started', handleGracePeriodStarted);
    socket.on('arena:ended', handleArenaEnded);
    socket.on('arena:redirect-to-results', handleRedirectToResults);

    return () => {
      // ✅ cleanup에서 interval 정리
      if (graceIntervalRef.current) {
        clearInterval(graceIntervalRef.current);
        graceIntervalRef.current = null;
      }
      
      socket.off('terminal:progress-data', handleProgressData);
      socket.off('terminal:prompt-data', handlePromptData);
      socket.off('terminal:result', handleTerminalResult);
      socket.off('terminal:error', handleTerminalError);
      socket.off('arena:grace-period-started', handleGracePeriodStarted);
      socket.off('arena:ended', handleArenaEnded);
      socket.off('arena:redirect-to-results', handleRedirectToResults);
    };
  }, [arena._id, socket, currentUserId, navigate]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmitCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isSubmitting || isCompleted) return;

    setIsSubmitting(true);
    setLogs(prev => [
      ...prev,
      { id: logCounter.current++, text: `root@target:~$ ${command}`, type: 'command' }
    ]);

    socket.emit('terminal:execute', { arenaId: arena._id, command: command.trim() });
    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitCommand(e as any);
    }
  };

  return (
    <div className="terminal-race-container">
      <div className="terminal-header">
        <div className="terminal-header-left">
          <h2>⚡ Terminal Race</h2>
          <p>Execute commands to complete the mission</p>
        </div>
        <div className="terminal-header-right">
          {!isLoading && (
            <>
              {graceTimeRemaining !== null && !isCompleted && (
                <div className="terminal-stat grace-timer">
                  <span className="stat-label">⏰ Time Left:</span>
                  <span className="stat-value warning">{graceTimeRemaining}s</span>
                </div>
              )}
              <div className="terminal-stat">
                <span className="stat-label">Stage:</span>
                <span className="stat-value">
                  {isCompleted ? totalStages : currentStage + 1}/{totalStages || '?'}
                </span>
              </div>
              <div className="terminal-stat">
                <span className="stat-label">Score:</span>
                <span className="stat-value">⭐ {currentScore}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="terminal-loading-container">
          <div className="loading-spinner"></div>
          <p>Loading scenario...</p>
        </div>
      ) : (
        <>
          <div className="terminal-output" ref={logContainerRef}>
            {logs.map(log => (
              <div key={log.id} className={`terminal-line ${log.type}`}>
                {log.type === 'command' && <span className="command-text">{log.text}</span>}
                {log.type === 'system' && <span className="system-text">{log.text}</span>}
                {(log.type === 'output' || log.type === 'success' || log.type === 'error') && <span>{log.text}</span>}
              </div>
            ))}
            {isSubmitting && (
              <div className="terminal-line output">
                <span className="loading-indicator">⏳ Processing...</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitCommand} className="terminal-input-area">
            <span className="terminal-prompt">root@target:~$</span>
            <input
              ref={inputRef}
              type="text"
              className="terminal-input"
              placeholder={isCompleted ? "Mission complete!" : "Enter command..."}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting || isCompleted}
              autoFocus
            />
            <button
              type="submit"
              className="terminal-submit-btn"
              disabled={isSubmitting || !command.trim() || isCompleted}
            >
              {isSubmitting ? '⏳' : isCompleted ? '✔' : '▶ RUN'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default TerminalRace;