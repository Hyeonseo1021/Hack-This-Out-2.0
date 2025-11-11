import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
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

interface LogEntry {
  id: number;
  text: string;
  type: 'prompt' | 'command' | 'output' | 'success' | 'error' | 'system';
}

const TerminalRace: React.FC<TerminalRaceProps> = ({ 
  arena, 
  socket, 
  currentUserId, 
  participants 
}) => {
  const [command, setCommand] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStage, setCurrentStage] = useState(0);
  const [totalStages, setTotalStages] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 초기 진행 상황 로드
  useEffect(() => {
    const loadProgress = async () => {
      try {
        socket.emit('terminal:get-progress', { arenaId: arena._id });
      } catch (error) {
        console.error('Failed to load progress:', error);
        setLogs([
          { id: logCounter.current++, text: 'Failed to load scenario. Please refresh.', type: 'error' }
        ]);
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [arena._id, socket]);

  // 서버 이벤트 수신
  useEffect(() => {
    // 진행 상황 응답 핸들러
    const handleProgressData = (data: ProgressData) => {
      const { stage, score, completed, prompt, totalStages: total } = data;
      
      setCurrentStage(stage);
      setCurrentScore(score);
      setIsCompleted(completed);
      if (total) setTotalStages(total);

      const initialLogs: LogEntry[] = [
        { id: logCounter.current++, text: '╔═══════════════════════════════════════════════════╗', type: 'system' },
        { id: logCounter.current++, text: '║          TERMINAL HACKING RACE - MISSION          ║', type: 'system' },
        { id: logCounter.current++, text: '╚═══════════════════════════════════════════════════╝', type: 'system' },
        { id: logCounter.current++, text: '', type: 'output' }
      ];

      if (completed) {
        initialLogs.push(
          { id: logCounter.current++, text: '🎉 MISSION ACCOMPLISHED! 🎉', type: 'success' },
          { id: logCounter.current++, text: `Final Score: ${score} points`, type: 'success' },
          { id: logCounter.current++, text: '', type: 'output' }
        );
      } else {
        // 현재 스테이지 정보 표시
        initialLogs.push(
          { id: logCounter.current++, text: `📊 Stage: ${stage + 1}/${total || '?'}`, type: 'system' },
          { id: logCounter.current++, text: `⭐ Current Score: ${score} points`, type: 'system' },
          { id: logCounter.current++, text: '', type: 'output' }
        );

        // 서버에서 받은 프롬프트 표시
        if (prompt) {
          initialLogs.push(
            { id: logCounter.current++, text: '─'.repeat(50), type: 'output' },
            { id: logCounter.current++, text: `📌 ${prompt}`, type: 'output' },
            { id: logCounter.current++, text: '─'.repeat(50), type: 'output' },
            { id: logCounter.current++, text: '', type: 'output' }
          );
        }
      }

      setLogs(initialLogs);
      setIsLoading(false);
      
      // 입력창에 포커스
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleTerminalResult = (data: TerminalResultData) => {
      // 내 결과만 수신
      if (data.userId !== currentUserId) {
        return;
      }

      const newLogs: LogEntry[] = [];
      
      // 서버에서 받은 메시지 표시
      if (data.message) {
        data.message.split('\n').forEach(line => {
          if (line.trim()) {
            let logType: LogEntry['type'] = 'output';
            
            // 점수 획득 시 성공 표시
            if (data.scoreGain && data.scoreGain > 0) {
              logType = 'success';
            }
            
            newLogs.push({ 
              id: logCounter.current++, 
              text: line,
              type: logType
            });
          }
        });
      }

      // 점수 표시
      if (data.scoreGain && data.scoreGain > 0) {
        newLogs.push({ 
          id: logCounter.current++, 
          text: `✨ +${data.scoreGain} points earned!`,
          type: 'success'
        });
      }

      // 스테이지 진행
      if (data.stageAdvanced) {
        newLogs.push(
          { id: logCounter.current++, text: '', type: 'output' },
          { id: logCounter.current++, text: '🎯 Stage Complete! Advancing...', type: 'success' },
          { id: logCounter.current++, text: '', type: 'output' }
        );
        
        // 상태 업데이트 (서버에서 새 프롬프트를 받음)
        if (data.currentStage !== undefined) {
          setCurrentStage(data.currentStage);
        }
      }

      // 미션 완료
      if (data.completed) {
        newLogs.push(
          { id: logCounter.current++, text: '', type: 'output' },
          { id: logCounter.current++, text: '═'.repeat(50), type: 'system' },
          { id: logCounter.current++, text: '🏆 MISSION COMPLETE! 🏆', type: 'success' },
          { id: logCounter.current++, text: `🎉 Final Score: ${data.totalScore || 0} points`, type: 'success' },
          { id: logCounter.current++, text: '═'.repeat(50), type: 'system' },
          { id: logCounter.current++, text: '', type: 'output' }
        );
        setIsCompleted(true);
      }

      // 현재 점수 업데이트
      if (data.totalScore !== undefined) {
        setCurrentScore(data.totalScore);
      }

      setLogs(prev => [...prev, ...newLogs]);
      setIsSubmitting(false);
      
      // 입력창에 다시 포커스
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    // 에러 핸들러
    const handleTerminalError = (data: { message: string }) => {
      setLogs(prev => [...prev, {
        id: logCounter.current++,
        text: `❌ ${data.message}`,
        type: 'error'
      }]);
      setIsSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    socket.on('terminal:progress-data', handleProgressData);
    socket.on('terminal:result', handleTerminalResult);
    socket.on('terminal:error', handleTerminalError);

    return () => {
      socket.off('terminal:progress-data', handleProgressData);
      socket.off('terminal:result', handleTerminalResult);
      socket.off('terminal:error', handleTerminalError);
    };
  }, [socket, currentUserId, arena._id]);

  // 자동 스크롤
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // 명령어 전송
  const handleSubmitCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isSubmitting || isCompleted) return;

    setIsSubmitting(true);
    
    // 프롬프트 표시
    setLogs(prev => [
      ...prev,
      { 
        id: logCounter.current++, 
        text: `root@target:~$ ${command}`, 
        type: 'command' 
      }
    ]);

    // 서버로 전송
    socket.emit('terminal:execute', { 
      arenaId: arena._id,
      command: command.trim() 
    });
    
    // 입력창 초기화
    setCommand('');
  };

  // Enter 키 처리
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitCommand(e as any);
    }
  };

  return (
    <div className="terminal-race-container">
      
      {/* 터미널 헤더 */}
      <div className="terminal-header">
        <div className="terminal-header-left">
          <h2>⚡ Terminal Race</h2>
          <p>Execute commands to complete the mission</p>
        </div>
        <div className="terminal-header-right">
          {!isLoading && (
            <>
              <div className="terminal-stat">
                <span className="stat-label">Stage:</span>
                <span className="stat-value">{currentStage + 1}/{totalStages || '?'}</span>
              </div>
              <div className="terminal-stat">
                <span className="stat-label">Score:</span>
                <span className="stat-value">⭐ {currentScore}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 로딩 중 */}
      {isLoading ? (
        <div className="terminal-loading-container">
          <div className="loading-spinner"></div>
          <p>Loading scenario...</p>
        </div>
      ) : (
        <>
          {/* 터미널 출력창 */}
          <div className="terminal-output" ref={logContainerRef}>
            {logs.map(log => (
              <div key={log.id} className={`terminal-line ${log.type}`}>
                {log.type === 'command' && (
                  <span className="command-text">{log.text}</span>
                )}
                {log.type === 'system' && (
                  <span className="system-text">{log.text}</span>
                )}
                {(log.type === 'output' || log.type === 'success' || log.type === 'error') && (
                  <span>{log.text}</span>
                )}
              </div>
            ))}
            {isSubmitting && (
              <div className="terminal-line output">
                <span className="loading-indicator">⏳ Processing...</span>
              </div>
            )}
          </div>

          {/* 터미널 입력창 */}
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
              {isSubmitting ? '⏳' : isCompleted ? '✓' : '▶ RUN'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default TerminalRace;