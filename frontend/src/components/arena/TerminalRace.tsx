import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import '../../assets/scss/arena/TerminalRace.scss'; // ‼️ SCSS 파일 임포트 ‼️

// --- (Interface 정의는 동일) ---

type Participant = {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
  progress?: any;
};

interface TerminalRaceProps {
  arena: { _id: string; mode: string; };
  socket: Socket;
  currentUserId: string | null; // ‼️ 부모로부터 받아올 내 ID
  participants: Participant[];  // ‼️ (ActivityFeed에서만 필요하지만, props 일관성을 위해 유지)
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
  isPrompt?: boolean; // ‼️ 내가 입력한 라인인지 구분용
}

const TerminalRace: React.FC<TerminalRaceProps> = ({ 
  arena, 
  socket, 
  currentUserId, 
  participants 
}) => {
  // 1. 상태 관리 (동일)
  const [command, setCommand] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logCounter = useRef(0);

  // (getUsernameById 헬퍼 함수는 이제 이 컴포넌트에서 필요 X, 삭제)

  // 2. 서버 이벤트 수신 (useEffect)
  useEffect(() => {
    // 2-1. ‼️ "내" 터미널 결과만 수신하도록 수정 ‼️
    const handleTerminalResult = (data: TerminalResultData) => {
      // ‼️ 서버가 보낸 결과의 주인이 "내가" 아니면 무시 ‼️
      if (data.userId !== currentUserId) {
        return;
      }

      const newLogs: LogEntry[] = [];
      
      // 2. 서버 응답 메시지를 여러 줄로 분리하여 추가
      data.message.split('\n').forEach(line => {
        newLogs.push({ id: logCounter.current++, text: line });
      });

      setLogs(prev => [...prev, ...newLogs]);
      
      // 3. (중요) '전송 중' 상태 해제
      setIsSubmitting(false);
    };

    // 2-2. (참고) 'participant:update'는 이제 부모(ArenaPlayPage)나
    //      ActivityFeed가 직접 듣고 처리해야 합니다.
    const handleParticipantUpdate = (data: any) => {
      // (이 터미널은 이제 이 이벤트에 반응할 필요가 없음)
    };

    // 2-3. 소켓 리스너 등록
    socket.on('terminal:result', handleTerminalResult);
    socket.on('participant:update', handleParticipantUpdate);

    // 2-4. 컴포넌트 언마운트 시 리스너 해제
    return () => {
      socket.off('terminal:result', handleTerminalResult);
      socket.off('participant:update', handleParticipantUpdate);
    };
    
  // 2. ‼️ 수정: 의존성 배열 수정 ‼️
  }, [socket, currentUserId]); // currentUserId가 바뀔 때 리스너 갱신

  // 3. 로그 변경 시 자동 스크롤 (동일)
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // 4. ‼️ 명령어 전송 (handleSubmit) (수정) ‼️
  const handleSubmitCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command || isSubmitting) return;

    setIsSubmitting(true);
    
    // 1. ‼️ "낙관적 업데이트" 부활 ‼️
    // (내 화면에 내가 친 명령어를 즉시 표시)
    setLogs(prev => [
      ...prev,
      { id: logCounter.current++, text: `root@target:~$ ${command}`, isPrompt: true }
    ]);

    // 2. 백엔드로 'terminal:execute' 이벤트 전송 (동일)
    socket.emit('terminal:execute', { command: command });
    
    // 3. 입력창 비우기 (동일)
    setCommand('');
  };

  // 5. 렌더링 (동일)
  return (
    <div className="ap-panel">
      <div className="ap-panel-header">
        <h3>MODE: {arena.mode}</h3>
      </div>
      <div className="ap-panel-body terminal-ui">
        {/* 가상 터미널 출력창 */}
        <div className="terminal-output" ref={logContainerRef}>
          <pre>Welcome to the Terminal Race!</pre>
          <pre>Type 'nmap -sV' to begin...</pre>
          <hr />
          {logs.map(log => (
            <pre 
              key={log.id} 
              className={log.isPrompt ? 'prompt-line' : ''}
            >
              {log.text}
            </pre>
          ))}
        </div>
        
        {/* 터미널 입력 폼 */}
        <form onSubmit={handleSubmitCommand} className="ap-flag-form">
          <span className="terminal-prompt">root@target:~$</span>
          <input
            type="text"
            className="ap-flag-input terminal-input"
            placeholder="Enter command..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            disabled={isSubmitting}
          />
          <button
            type="submit"
            className="ap-button primary terminal-submit-btn"
            disabled={isSubmitting || !command}
          >
            <span>{isSubmitting ? '...' : 'RUN'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default TerminalRace;