import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import '../../assets/scss/arena/ActivityFeed.scss';

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
  userId: string;
  text: string;
  type: 'flag' | 'stage' | 'score' | 'command';
  timestamp: Date;
  isMe: boolean;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ 
  socket, 
  currentUserId, 
  participants
}) => {
  const [feeds, setFeeds] = useState<FeedEntry[]>([]);
  const feedCounter = useRef(0);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const getUsernameById = (userId: string): string => {
    const p = participants.find(p => (typeof p.user === 'string' ? p.user : p.user._id) === userId);
    if (p && typeof p.user === 'object') {
      return p.user.username;
    }
    return 'Unknown';
  };

  // 초기 활동 내역 복원 (participants의 progress 기반)
  useEffect(() => {
    console.log('📜 Restoring activity from participants progress');
    
    const initialFeeds: FeedEntry[] = [];
    
    participants.forEach(p => {
      const uid = typeof p.user === 'string' ? p.user : p.user._id;
      const username = typeof p.user === 'string' ? '...' : p.user.username;
      const isMe = uid === currentUserId;
      
      // progress가 있고 점수가 0보다 크면 활동이 있었던 것
      if (p.progress && p.progress.score > 0) {
        const score = p.progress.score;
        const stage = p.progress.stage || 0;
        const completed = p.progress.completed || false;
        
        // 완료한 경우
        if (completed) {
          initialFeeds.push({
            id: feedCounter.current++,
            userId: uid,
            text: `${username} found the FLAG! 🏆`,
            type: 'flag',
            timestamp: new Date(),
            isMe
          });
        } 
        // 스테이지 진행 중
        else if (stage > 0) {
          initialFeeds.push({
            id: feedCounter.current++,
            userId: uid,
            text: `${username} is at stage ${stage + 1} (${score} pts)`,
            type: 'stage',
            timestamp: new Date(),
            isMe
          });
        }
        // 점수만 있는 경우
        else if (score > 0) {
          initialFeeds.push({
            id: feedCounter.current++,
            userId: uid,
            text: `${username} scored ${score} points`,
            type: 'score',
            timestamp: new Date(),
            isMe
          });
        }
      }
    });
    
    setFeeds(initialFeeds);
  }, []); // 최초 마운트 시에만 실행

  // 자동 스크롤
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feeds]);

  useEffect(() => {
    const handleTerminalResult = (data: TerminalResultData) => {
      const username = getUsernameById(data.userId);
      const isMe = data.userId === currentUserId;
      let entry: { text: string; type: FeedEntry['type'] } | null = null;

      // 🚩 플래그 발견 - 모두에게 표시 (경쟁 요소)
      if (data.flagFound) {
        entry = {
          text: `${username} found the FLAG! 🏆`,
          type: 'flag'
        };
      } 
      // ✅ 스테이지 진행 - 모두에게 표시 (누가 앞서가는지)
      else if (data.advanceStage) {
        entry = {
          text: `${username} advanced to next stage`,
          type: 'stage'
        };
      } 
      // 📈 점수 획득 - 모두에게 표시 (단, 명령어는 본인만)
      else if (data.progressDelta && data.progressDelta > 0) {
        if (isMe) {
          // 본인: 명령어 포함
          entry = {
            text: `You executed '${data.command}' (+${data.progressDelta} pts)`,
            type: 'command'
          };
        } else {
          // 다른 사람: 점수만 표시
          entry = {
            text: `${username} scored +${data.progressDelta} points`,
            type: 'score'
          };
        }
      }

      if (entry) {
        const newEntry: FeedEntry = {
          id: feedCounter.current++,
          userId: data.userId,
          text: entry.text,
          type: entry.type,
          timestamp: new Date(),
          isMe
        };

        setFeeds(prev => {
          const updated = [...prev, newEntry];
          // 최대 50개까지만 유지 (성능)
          return updated.slice(-50);
        });
      }
    };

    socket.on('terminal:result', handleTerminalResult);

    return () => {
      socket.off('terminal:result', handleTerminalResult);
    };
  }, [socket, currentUserId, participants]);

  return (
    <div className="activity-feed-container">
      <div className="activity-feed-header">
        <h3>Activity</h3>
        <span className="activity-count">{feeds.length}</span>
      </div>
      <div className="activity-feed-body">
        {feeds.length === 0 ? (
          <div className="feed-empty">
            <span>Waiting for activity...</span>
          </div>
        ) : (
          <>
            {feeds.map(feed => (
              <div 
                key={feed.id} 
                className={`feed-item feed-${feed.type} ${feed.isMe ? 'feed-me' : ''}`}
              >
                <span className="feed-icon">
                  {feed.type === 'flag' && '🚩'}
                  {feed.type === 'stage' && '⬆️'}
                  {feed.type === 'score' && '✨'}
                  {feed.type === 'command' && '▶'}
                </span>
                <span className="feed-text">{feed.text}</span>
              </div>
            ))}
            <div ref={feedEndRef} />
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;