// src/pages/arena/ArenaRoomPage.tsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import Main from '../../components/main/Main';
import { getArenaById } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaRoomPage.scss';

type Participant = {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
  startTime?: Date;
  endTime?: Date;
};

type ArenaUpdatePayload = {
  arenaId: string;
  status: 'waiting' | 'started' | 'ended' | string;
  host: string;
  startTime?: string | null;
  endTime?: string | null;
  participants: Participant[];
};

const ArenaRoomPage: React.FC = () => {
  const { id: arenaId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [arenaName, setArenaName] = useState('');
  const [status, setStatus] = useState<'waiting' | 'started' | 'ended'>('waiting');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const skipLeaveRef = useRef(false);

  const myParticipant = useMemo(
    () => participants.find(p => (typeof p.user === 'string' ? p.user : p.user._id) === currentUserId),
    [participants, currentUserId]
  );
  const activeParticipants = useMemo(
    () => participants.filter(p => !p.hasLeft),
    [participants]
  );
  const everyoneReady = useMemo(
    () => activeParticipants.length > 0 && activeParticipants.every(p => p.isReady),
    [activeParticipants]
  );
  const nonHostParticipants = useMemo(() => {
    return participants.filter(p => {
      const uid = typeof p.user === 'string' ? p.user : p.user._id;
      return uid !== hostId;
    });
  }, [participants, hostId]);

  const everyoneExceptHostReady = useMemo(() => {
    return nonHostParticipants.length > 0 && nonHostParticipants.every(p => p.isReady);
  }, [nonHostParticipants]);

  useEffect(() => {
    getUserStatus()
      .then(res => setCurrentUserId(res?.user?._id ?? res?.data?.user?._id ?? null))
      .catch(() => { /* ignore */ });

    if (arenaId) {
      getArenaById(arenaId)
        .then(res => setArenaName(res?.name ?? res?.data?.name ?? ''))
        .catch(() => { /* ignore */ });
    }
  }, [arenaId]);

  useEffect(() => {
    if (!arenaId || !currentUserId) return;

    socket.off('arena:update');
    socket.off('arena:join-failed');
    socket.off('arena:start');
    socket.off('arena:start-failed');
    socket.off('arena:ready-failed');

    const handleUpdate = (payload: ArenaUpdatePayload) => {
      console.log('📡 arena:update 받음:', payload);
      setStatus((payload.status as any) || 'waiting');
      setHostId(payload.host || null);
      setIsHost(payload.host === currentUserId);
      setParticipants(payload.participants || []);

      // ✅ 수정: started 상태여도 바로 이동하지 않음 (arena:start에서 처리)
      // if (payload.status === 'started') {
      //   skipLeaveRef.current = true;
      //   navigate(`/arena/play/${payload.arenaId}`);
      // }
    };

    const handleJoinFailed = ({ reason }: { reason: string }) => {
      alert(reason);
      navigate('/arena');
    };

    // ✅ 수정: arena:start 이벤트를 받으면 모든 플레이어가 로딩 상태로 전환
    const handleStart = (data: { arenaId: string; startTime?: string; endTime?: string; needVpnConnection?: boolean }) => {
      console.log('🎮 arena:start 이벤트 수신:', data);
      console.log('🎮 현재 사용자:', currentUserId);
      console.log('🎮 호스트:', hostId);
      setIsStarting(true); // 모든 플레이어에게 로딩 화면 표시
      
      // 2-3초 후 플레이 페이지로 이동 (로딩 화면을 보여주기 위해)
      setTimeout(() => {
        skipLeaveRef.current = true;
        navigate(`/arena/play/${data.arenaId}`);
      }, 2500);
    };

    const handleStartFailed = ({ reason }: { reason: string }) => {
      setIsStarting(false);
      alert(reason);
    };

    const handleReadyFailed = ({ reason }: { reason: string }) => {
      alert(reason);
    };

    socket.on('arena:update', handleUpdate);
    socket.on('arena:join-failed', handleJoinFailed);
    socket.on('arena:start', handleStart);
    socket.on('arena:start-failed', handleStartFailed);
    socket.on('arena:ready-failed', handleReadyFailed);

    console.log('✅ 소켓 리스너 등록 완료 - arenaId:', arenaId, 'userId:', currentUserId);
    console.log('✅ 소켓 연결 상태:', socket.connected);

    socket.emit('arena:join', { arenaId, userId: currentUserId });

    return () => {
      if (!skipLeaveRef.current) {
        socket.emit('arena:leave', { arenaId, userId: currentUserId });
      }
      socket.off('arena:update', handleUpdate);
      socket.off('arena:join-failed', handleJoinFailed);
      socket.off('arena:start', handleStart);
      socket.off('arena:start-failed', handleStartFailed);
      socket.off('arena:ready-failed', handleReadyFailed);
    };
  }, [arenaId, currentUserId, navigate]);

  useEffect(() => {
    if (!arenaId) return;

    const handleRoomUpdatedThisRoom = (updated: {
      _id: string;
      participants?: { user: string }[];
    }) => {
      if (!updated || updated._id !== arenaId) return;

      const ids = new Set((updated.participants ?? []).map(u => String(u.user)));

      setParticipants(prev => prev.filter(p => {
        const uid = typeof p.user === 'string' ? p.user : p.user._id;
        return ids.has(uid);
      }));

      socket.emit('arena:sync', { arenaId });
    };

    socket.on('arena:room-updated', handleRoomUpdatedThisRoom);
    return () => {
      socket.off('arena:room-updated', handleRoomUpdatedThisRoom);
    };
  }, [arenaId]);

  const toggleReady = () => {
    if (!arenaId || !currentUserId) return;
    if (status !== 'waiting') return;
    const next = !(myParticipant?.isReady ?? false);
    socket.emit('arena:ready', { arenaId, userId: currentUserId, ready: next });
  };

  // ✅ 로딩 화면이 활성화되면 메인 콘텐츠를 완전히 숨김
  if (isStarting) {
    return (
      <Main>
        <div className="game-loading-fullscreen">
          <div className="loading-background"></div>
          <div className="loading-content">
            <div className="loading-spinner">
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
            </div>
            <h1 className="loading-title">머신을 해킹하세요!</h1>
            <div className="loading-bar-container">
              <div className="loading-bar">
                <div className="loading-bar-fill"></div>
              </div>
            </div>
            <p className="loading-text">게임 준비중...</p>
            <div className="loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        </div>
      </Main>
    );
  }

  return (
    <Main>
      <div className="battle-cyber-container room-variant">
        <div className="background-grid"></div>
        <div className="cyber-module">
          <h1 className="cyber-title" data-text={arenaName}>{arenaName}</h1>

          <div className="participants-grid">
            {activeParticipants.map(p => {
              const userObject = typeof p.user === 'object' ? p.user : { _id: p.user, username: 'Loading...' };
              const isUserHost = userObject._id === hostId;
              const isMe = userObject._id === currentUserId;

              return (
                <div 
                  key={userObject._id}
                  className={`participant-card ${p.isReady ? 'is-ready' : ''} ${isUserHost ? 'is-host' : ''} ${isMe ? 'is-me' : ''}`}
                >
                  <div className="card-bg"></div>
                  <div className="card-content">
                    <span className="username">{userObject.username}</span>
                    <span className="status">{p.isReady ? 'READY' : 'NOT READY'}</span>
                  </div>
                  {isUserHost && <div className="host-tag">HOST</div>}
                </div>
              );
            })}
          </div>

          <div className="footer-actions">
            {isHost ? (
              <button
                className="cyber-button"
                disabled={status !== 'waiting' || !everyoneExceptHostReady || activeParticipants.length < 2 || isStarting}
                onClick={() => { 
                  console.log('🚀 START GAME 버튼 클릭 - arenaId:', arenaId, 'userId:', currentUserId);
                  setIsStarting(true); 
                  socket.emit('arena:start', { arenaId, userId: currentUserId }); 
                }}
              >
                <span data-text={isStarting ? 'STARTING...' : 'START GAME'}>{isStarting ? 'STARTING...' : 'START GAME'}</span>
                <div className="button-loader"></div>
              </button>
            ) : (
              <button
                className={`cyber-button ${myParticipant?.isReady ? 'is-ready-button' : ''}`}
                disabled={status !== 'waiting' || isStarting}
                onClick={toggleReady}
              >
                <span data-text={myParticipant?.isReady ? 'CANCEL' : 'READY'}>
                  {myParticipant?.isReady ? 'CANCEL' : 'READY'}
                </span>
                <div className="button-loader"></div>
              </button>
            )}
          </div>
        </div>
      </div>
    </Main>
  );
};

export default ArenaRoomPage;