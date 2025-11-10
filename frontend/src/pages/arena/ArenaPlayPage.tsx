// src/pages/arena/ArenaPlayPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import Main from '../../components/main/Main';
import { getArenaById } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaPlayPage.scss';

import TerminalRace from '../../components/arena/TerminalRace';
import ActivityFeed from '../../components/arena/ActivityFeed';

type Participant = {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
  progress?: any;
};

type ArenaUpdatePayload = {
  arenaId: string;
  status: 'waiting' | 'started' | 'ended';
  host: string;
  startTime?: string | null;
  endTime?: string | null;
  participants: Participant[];
  mode: string;
};

const ArenaPlayPage: React.FC = () => {
  const { id: arenaId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [arenaName, setArenaName] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState<'waiting' | 'started' | 'ended'>('waiting');
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [mode, setMode] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  const joinedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const getParticipantStatus = (p: Participant) => {
    if (p.hasLeft) return { text: 'Left', color: '#666' };
    
    if (status === 'waiting') {
      return p.isReady 
        ? { text: 'Ready', color: '#00ff88' } 
        : { text: 'Waiting', color: '#ff9500' };
    }
    
    if (status === 'started') {
      return { text: 'Active', color: '#00d4ff' };
    }
    
    return { text: '', color: '#666' };
  };

  // 초기 로드
  useEffect(() => {
    if (!arenaId) return;

    (async () => {
      const { user } = await getUserStatus();
      setCurrentUserId(user._id);

      const arenaData = await getArenaById(arenaId);
      setArenaName(arenaData.name);
      setHostId(String(arenaData.host));
      setStatus(arenaData.status);
      setMode(arenaData.mode);
      if (arenaData.startTime) setStartAt(new Date(arenaData.startTime));
      if (arenaData.endTime) setEndAt(new Date(arenaData.endTime));
      setParticipants(arenaData.participants || []);

      if (!joinedRef.current) {
        joinedRef.current = true;
        const doJoin = () => socket.emit('arena:join', { arenaId, userId: user._id });
        if (socket.connected) doJoin();
        else socket.once('connect', doJoin);
      }
    })();
  }, [arenaId, navigate]);

  // 타이머 관리
  useEffect(() => {
    if (!endAt) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const end = endAt.getTime();
      const diff = end - now;
      setRemaining(Math.max(0, diff));
      
      if (diff <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        socket.emit('arena:end', { arenaId });
        navigate(`/arena/result/${arenaId}`);
      }
    };

    tick();
    timerRef.current = window.setInterval(tick, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [endAt, status, arenaId, navigate]);

  // 타임업 처리
  useEffect(() => {
    if (status === 'ended') {
      navigate(`/arena/result/${arenaId}`);
    }
  }, [status, arenaId, navigate]);

  // 소켓 이벤트
  useEffect(() => {
    const handleUpdate = (payload: ArenaUpdatePayload) => {
      setStatus(payload.status);
      setHostId(payload.host);
      setParticipants(payload.participants || []);
      if (payload.startTime) setStartAt(new Date(payload.startTime));
      if (payload.endTime) setEndAt(new Date(payload.endTime));
      if (payload.mode) setMode(payload.mode);
      
      if (payload.status === 'ended') {
        navigate(`/arena/result/${payload.arenaId}`);
      }
    };

    const handleStart = (data: { arenaId: string; startTime: string; endTime: string; }) => {
      console.log('Arena started!', data);
    };

    const handleDeleted = ({ arenaId: deleted }: { arenaId: string }) => {
      if (deleted === arenaId) navigate('/arena');
    };

    const handleJoinFailed = ({ reason }: { reason: string }) => {
      alert(reason);
      navigate('/arena');
    };

    const handleEnded = (data?: { arenaId?: string }) => {
      navigate(`/arena/result/${data?.arenaId ?? arenaId}`);
    };

    socket.on('arena:update', handleUpdate);
    socket.on('arena:start', handleStart);
    socket.on('arena:deleted', handleDeleted);
    socket.on('arena:join-failed', handleJoinFailed);
    socket.on('arena:ended', handleEnded);

    return () => {
      if (currentUserId && arenaId) {
        socket.emit('arena:leave', { arenaId, userId: currentUserId });
      }
      socket.off('arena:update', handleUpdate);
      socket.off('arena:start', handleStart);
      socket.off('arena:deleted', handleDeleted);
      socket.off('arena:join-failed', handleJoinFailed);
      socket.off('arena:ended', handleEnded);
    };
  }, [arenaId, currentUserId, navigate]);

  // 시간 포맷
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  const renderGameContent = () => {
    if (!mode) {
      return (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading game mode...</p>
        </div>
      );
    }

    const currentArenaProps = {
      _id: arenaId!,
      name: arenaName,
      mode: mode!,
      status: status,
      host: hostId!,
      startTime: startAt?.toISOString() || null,
      endTime: endAt?.toISOString() || null,
      participants: participants
    };

    switch (mode) {
      case 'Terminal Race':
        return <TerminalRace arena={currentArenaProps} socket={socket} currentUserId={currentUserId} participants={participants} />;
      case "Hacker's Deck":
        return (
          <div className="coming-soon">
            <h2>Hacker's Deck</h2>
            <p>Coming Soon</p>
          </div>
        );
      case 'Defense Battle':
      case 'Capture Server':
      case 'Exploit Chain':
        return (
          <div className="coming-soon">
            <h2>{mode}</h2>
            <p>Coming Soon</p>
          </div>
        );
      default:
        return (
          <div className="error-state">
            <h2>Unknown Game Mode</h2>
            <p>{mode}</p>
          </div>
        );
    }
  };

  const activeCount = participants.filter(p => !p.hasLeft).length;

  return (
    <Main>
      <div className="arena-play-page">
        
        {/* 상단 헤더 */}
        <header className="arena-header">
          <div className="header-left">
            <h1 className="arena-title">{arenaName}</h1>
            <span className={`status-badge status-${status}`}>
              {status.toUpperCase()}
            </span>
            <span className="mode-badge">{mode || 'Loading...'}</span>
          </div>
          
          <div className="header-right">
            <div className="timer-display">
              <div className="timer-value">
                {mm}:{String(ss).padStart(2, '0')}
              </div>
              <div className="timer-label">Remaining</div>
            </div>
            
            <button 
              className="sidebar-toggle"
              onClick={() => setShowSidebar(!showSidebar)}
              title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            >
              {showSidebar ? '✕' : '☰'}  
            </button>
          </div>
        </header>

        {/* 메인 컨텐츠 영역 */}
        <div className="arena-content">
          
          {/* 게임 영역 */}
          <main className="game-area">
            {renderGameContent()}
          </main>

          {/* 사이드바 */}
          {showSidebar && (
            <aside className="arena-sidebar">
              
              {/* 참가자 목록 */}
              <div className="sidebar-section">
                <div className="section-header">
                  <h3>Players</h3>
                  <span className="player-count">{activeCount}/{participants.length}</span>
                </div>
                
                <div className="participants-list">
                  {participants.map(p => {
                    const uid = typeof p.user === 'string' ? p.user : p.user._id;
                    const name = typeof p.user === 'string' ? '...' : p.user.username;
                    const isHost = uid === hostId;
                    const isMe = uid === currentUserId;
                    const { text, color } = getParticipantStatus(p);

                    return (
                      <div 
                        key={uid} 
                        className={`participant-card ${isMe ? 'is-me' : ''} ${p.hasLeft ? 'has-left' : ''}`}
                      >
                        <div className="participant-info">
                          <div className="participant-name">
                            {name}
                            {isHost && <span className="badge badge-host">HOST</span>}
                            {isMe && <span className="badge badge-you">YOU</span>}
                          </div>
                        </div>
                        <div 
                          className="participant-status"
                          style={{ color }}
                        >
                          {text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Activity Feed - 자신의 활동만 표시 */}
              {mode === 'Terminal Race' && status === 'started' && (
                <div className="sidebar-section">
                  <ActivityFeed 
                    socket={socket} 
                    currentUserId={currentUserId}
                    participants={participants}
                  />
                </div>
              )}

              {/* 게임 정보 */}
              <div className="sidebar-section">
                <div className="section-header">
                  <h3>Info</h3>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Start Time</label>
                    <span>{startAt ? new Date(startAt).toLocaleTimeString() : 'Pending'}</span>
                  </div>
                  <div className="info-item">
                    <label>Duration</label>
                    <span>{endAt && startAt ? `${Math.round((endAt.getTime() - startAt.getTime()) / 60000)}min` : '---'}</span>
                  </div>
                </div>
              </div>

            </aside>
          )}

        </div>
      </div>
    </Main>
  );
}

export default ArenaPlayPage;