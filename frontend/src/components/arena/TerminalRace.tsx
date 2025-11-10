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
  progressDelta?: number;
  flagFound?: boolean;
}

interface LogEntry {
  id: number;
  text: string;
  type: 'prompt' | 'command' | 'output' | 'success' | 'error';
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
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 초기 진행 상황 로드
  useEffect(() => {
    const loadProgress = async () => {
      try {
        // 서버에서 현재 유저의 진행 상황 요청
        socket.emit('terminal:get-progress', { arenaId: arena._id });
      } catch (error) {
        console.error('Failed to load progress:', error);
        // 에러 시 기본 웰컴 메시지만 표시
        setLogs([
          { id: logCounter.current++, text: 'Welcome to the Terminal Race!', type: 'success' },
          { id: logCounter.current++, text: "Type 'nmap -sV' to begin...", type: 'output' }
        ]);
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [arena._id, socket]);

  // 서버 이벤트 수신
  useEffect(() => {
    // 진행 상황 응답 핸들러
    const handleProgressData = (data: { stage: number; score: number; completed: boolean }) => {
      const initialLogs: LogEntry[] = [
        { id: logCounter.current++, text: 'Welcome to the Terminal Race!', type: 'success' },
        { id: logCounter.current++, text: '='.repeat(50), type: 'output' }
      ];

      // 현재 스테이지에 따른 안내 메시지
      if (data.stage === 0) {
        initialLogs.push(
          { id: logCounter.current++, text: 'Stage 1: Reconnaissance', type: 'success' },
          { id: logCounter.current++, text: "Start by scanning the target.", type: 'output' }
        );
      } else if (data.stage === 1) {
        initialLogs.push(
          { id: logCounter.current++, text: 'Stage 1: Completed ✓', type: 'success' },
          { id: logCounter.current++, text: 'Stage 2: Attack', type: 'success' },
          { id: logCounter.current++, text: "Try to exploit the services.", type: 'output' }
        );
      } else if (data.stage === 2) {
        initialLogs.push(
          { id: logCounter.current++, text: 'Stage 1-2: Completed ✓', type: 'success' },
          { id: logCounter.current++, text: 'Stage 3: Privilege Escalation', type: 'success' },
          { id: logCounter.current++, text: "Find SUID binaries.", type: 'output' }
        );
      } else if (data.stage === 3) {
        initialLogs.push(
          { id: logCounter.current++, text: 'Stage 1-3: Completed ✓', type: 'success' },
          { id: logCounter.current++, text: 'Stage 4: Flag Capture', type: 'success' },
          { id: logCounter.current++, text: "Get the final flag.", type: 'output' }
        );
      } else if (data.completed) {
        initialLogs.push(
          { id: logCounter.current++, text: 'All Stages Completed! 🎉', type: 'success' },
          { id: logCounter.current++, text: `Final Score: ${data.score} points`, type: 'success' }
        );
      }

      initialLogs.push(
        { id: logCounter.current++, text: '='.repeat(50), type: 'output' },
        { id: logCounter.current++, text: `Current Score: ${data.score} points`, type: 'output' },
        { id: logCounter.current++, text: '', type: 'output' }
      );

      setLogs(initialLogs);
      setIsLoading(false);
    };

    const handleTerminalResult = (data: TerminalResultData) => {
      // 내 결과만 수신
      if (data.userId !== currentUserId) {
        return;
      }

      const newLogs: LogEntry[] = [];
      
      // 서버 응답 처리
      data.message.split('\n').forEach(line => {
        let logType: LogEntry['type'] = 'output';
        
        // 메시지 타입 자동 감지
        if (line.includes('FLAG{') || data.flagFound) {
          logType = 'success';
        } else if (line.includes('Error') || line.includes('failed') || line.includes('not found')) {
          logType = 'error';
        } else if (data.progressDelta && data.progressDelta > 0) {
          logType = 'success';
        }
        
        newLogs.push({ 
          id: logCounter.current++, 
          text: line,
          type: logType
        });
      });

      setLogs(prev => [...prev, ...newLogs]);
      setIsSubmitting(false);
      
      // 입력창에 다시 포커스
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    socket.on('terminal:progress-data', handleProgressData);
    socket.on('terminal:result', handleTerminalResult);

    return () => {
      socket.off('terminal:progress-data', handleProgressData);
      socket.off('terminal:result', handleTerminalResult);
    };
  }, [socket, currentUserId]);

  // 자동 스크롤
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // 명령어 전송
  const handleSubmitCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isSubmitting) return;

    setIsSubmitting(true);
    
    // 프롬프트 표시
    setLogs(prev => [
      ...prev,
      { 
        id: logCounter.current++, 
        text: 'root@target:~$', 
        type: 'prompt' 
      },
      { 
        id: logCounter.current++, 
        text: command, 
        type: 'command' 
      }
    ]);

    // 서버로 전송
    socket.emit('terminal:execute', { command: command.trim() });
    
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
        <h2>Terminal Race</h2>
        <p>Complete the stages by executing the correct commands!</p>
      </div>

      {/* 로딩 중 */}
      {isLoading ? (
        <div className="terminal-loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your progress...</p>
        </div>
      ) : (
        <>
          {/* 터미널 출력창 */}
          <div className="terminal-output" ref={logContainerRef}>
        {logs.map(log => (
          <div key={log.id} className={`terminal-line ${log.type}`}>
            {log.type === 'prompt' && <span className="prompt-symbol">{log.text}</span>}
            {log.type === 'command' && <span className="command-text">$ {log.text}</span>}
            {(log.type === 'output' || log.type === 'success' || log.type === 'error') && (
              <span>{log.text}</span>
            )}
          </div>
        ))}
        {isSubmitting && (
          <div className="terminal-line output">
            <span className="loading-indicator">Processing...</span>
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
          placeholder="Enter command..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSubmitting}
          autoFocus
        />
        <button
          type="submit"
          className="terminal-submit-btn"
          disabled={isSubmitting || !command.trim()}
        >
          {isSubmitting ? '⏳' : '▶ RUN'}
        </button>
      </form>
        </>
      )}
    </div>
  );
}

export default TerminalRace;