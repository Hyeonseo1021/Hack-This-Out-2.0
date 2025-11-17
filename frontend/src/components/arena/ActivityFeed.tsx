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

// ✅ terminal:result 이벤트 타입
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

// ✅ participant:update 이벤트 타입 추가
interface ParticipantUpdateData {
  userId: string;
  progress: {
    score: number;
    stage: number;
    completed: boolean;
  };
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
  const listenersRegisteredRef = useRef(false);
  const participantsRef = useRef(participants);
  const lastStageRef = useRef<Map<string, number>>(new Map()); // ✅ 스테이지 변화 감지용

  // participants를 ref로 유지하여 최신 값 참조
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const getUsernameById = (userId: string): string => {
    const p = participantsRef.current.find(p => (typeof p.user === 'string' ? p.user : p.user._id) === userId);
    if (p && typeof p.user === 'object') {
      return p.user.username;
    }
    return 'Unknown';
  };

  // 초기 활동 내역 복원 (participants의 progress 기반)
  useEffect(() => {
    console.log('📜 [ActivityFeed] Restoring activity from participants progress');
    
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
        
        // 마지막 스테이지 기록
        lastStageRef.current.set(uid, stage);
        
        // 완료한 경우
        if (completed) {
          initialFeeds.push({
            id: feedCounter.current++,
            userId: uid,
            text: `${username} completed all stages! 🏆`,
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
    if (listenersRegisteredRef.current) return;
    listenersRegisteredRef.current = true;

    console.log('🔧 [ActivityFeed] Registering socket listeners');

    // ✅ terminal:result - 자신의 명령어 실행 결과만 표시
    const handleTerminalResult = (data: TerminalResultData) => {
      console.log('📢 [ActivityFeed] Terminal result:', data);

      // 자신의 결과만 처리 (명령어 표시용)
      if (data.userId !== currentUserId) {
        return;
      }

      const username = getUsernameById(data.userId);
      const isMe = true;

      // 명령어 실행만 표시 (점수는 participant:update에서 처리)
      if (data.scoreGain && data.scoreGain > 0 && data.command) {
        const entry: FeedEntry = {
          id: feedCounter.current++,
          userId: data.userId,
          text: `You: ${data.command} (+${data.scoreGain} pts)`,
          type: 'command',
          timestamp: new Date(),
          isMe
        };

        console.log('✅ [ActivityFeed] Adding command entry:', entry);

        setFeeds(prev => [...prev, entry].slice(-50));
      }
    };

    // ✅ participant:update - 모든 플레이어의 진행 상황 표시
    const handleParticipantUpdate = (data: ParticipantUpdateData) => {
      console.log('📊 [ActivityFeed] Participant update:', data);

      const username = getUsernameById(data.userId);
      const isMe = data.userId === currentUserId;
      const lastStage = lastStageRef.current.get(data.userId) || 0;
      const currentStage = data.progress.stage;

      let entry: { text: string; type: FeedEntry['type'] } | null = null;

      // 🏆 모든 스테이지 완료
      if (data.progress.completed) {
        entry = {
          text: `${username} completed all stages! 🏆`,
          type: 'flag'
        };
      }
      // ⬆️ 스테이지 진행
      else if (currentStage > lastStage) {
        entry = {
          text: `${username} advanced to stage ${currentStage + 1}`,
          type: 'stage'
        };
        lastStageRef.current.set(data.userId, currentStage);
      }
      // ✨ 점수 획득 (자신의 명령어가 아닌 경우만)
      else if (!isMe && data.progress.score > 0) {
        entry = {
          text: `${username} scored ${data.progress.score} pts`,
          type: 'score'
        };
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

        console.log('✅ [ActivityFeed] Adding entry:', newEntry);

        setFeeds(prev => [...prev, newEntry].slice(-50));
      }
    };

    socket.on('terminal:result', handleTerminalResult);
    socket.on('participant:update', handleParticipantUpdate); // ✅ 추가

    return () => {
      console.log('🔧 [ActivityFeed] Cleaning up listeners');
      socket.off('terminal:result', handleTerminalResult);
      socket.off('participant:update', handleParticipantUpdate); // ✅ 추가
      listenersRegisteredRef.current = false;
    };
  }, [socket, currentUserId]);

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