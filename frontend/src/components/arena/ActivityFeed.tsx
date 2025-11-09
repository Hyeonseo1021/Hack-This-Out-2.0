import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import '../../assets/scss/arena/ActivityFeed.scss'; // (SCSS 파일도 새로 만듭니다)

// (Props와 Interface 정의)
type Participant = {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
  progress?: any;
};

interface ActivityFeedProps {
  socket: Socket;
  currentUserId: string | null;
  participants: Participant[];
}

interface TerminalResultData {
  userId: string;
  command: string;
  message: string;
  progressDelta?: number;
  advanceStage?: boolean;
  flagFound?: boolean;
}

interface FeedEntry {
  id: number;
  text: string;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ socket, currentUserId, participants }) => {
  const [feeds, setFeeds] = useState<FeedEntry[]>([]);
  const feedCounter = useRef(0);

  const getUsernameById = (userId: string): string => {
    const p = participants.find(p => (typeof p.user === 'string' ? p.user : p.user._id) === userId);
    if (p && typeof p.user === 'object') {
      return p.user.username;
    }
    return 'Unknown';
  };

  useEffect(() => {
    // ‼️ "활동 피드"는 'terminal:result'를 듣고 요약된 정보만 표시합니다.
    const handleTerminalResult = (data: TerminalResultData) => {
      // (data: { userId, command, message, ... })
      
      const username = getUsernameById(data.userId);
      let entry: string | null = null;

      // 기획서 [cite: 35-38] 처럼 '주요 성과'만 로그로 남깁니다.
      if (data.flagFound) {
        entry = `🚩 ${username} found the FLAG!`;
      } else if (data.advanceStage) {
        entry = `✅ ${username} advanced to the next stage.`;
      } else if (data.progressDelta && data.progressDelta > 0) {
        entry = `+ ${username} executed '${data.command}' (Score +${data.progressDelta})`;
      }

      // (선택) 모든 명령어 로깅 (너무 많을 수 있음)
      // if (!entry) {
      //   entry = `> ${username} ran '${data.command}'`;
      // }

      if (entry) {
        setFeeds(prev => [
          ...prev, 
          { id: feedCounter.current++, text: entry! }
        ]);
      }
    };

    socket.on('terminal:result', handleTerminalResult);

    return () => {
      socket.off('terminal:result', handleTerminalResult);
    };
  }, [socket, currentUserId, participants]);

  return (
    <div className="ap-panel">
      <div className="ap-panel-header">
        <h3>ACTIVITY FEED</h3>
      </div>
      <div className="ap-panel-body activity-feed">
        {feeds.length === 0 && (
          <p className="feed-item empty">Waiting for player activity...</p>
        )}
        {feeds.map(feed => (
          <p key={feed.id} className="feed-item">
            {feed.text}
          </p>
        ))}
      </div>
    </div>
  );
};

export default ActivityFeed;