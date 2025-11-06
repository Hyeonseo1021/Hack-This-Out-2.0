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
  host: string; // 서버가 문자열로 보냄
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

  // 내 카드 / 활성 인원 / 전체 준비 여부
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
  // 호스트 제외 활성 참가자
  const nonHostParticipants = useMemo(() => {
    return participants.filter(p => {
      const uid = typeof p.user === 'string' ? p.user : p.user._id;
      return uid !== hostId; // host 제외
    });
  }, [participants, hostId]);

  // 호스트 제외 모두 준비
  const everyoneExceptHostReady = useMemo(() => {
    return nonHostParticipants.length > 0 && nonHostParticipants.every(p => p.isReady);
  }, [nonHostParticipants]);


  // 유저/아레나 이름 로딩
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

  // 소켓 바인딩 + join + cleanup
  useEffect(() => {
    if (!arenaId || !currentUserId) return;

    // 중복 리스너 방지
    socket.off('arena:update');
    socket.off('arena:join-failed');
    socket.off('arena:start');
    socket.off('arena:start-failed');
    socket.off('arena:ready-failed');

    const handleUpdate = (payload: ArenaUpdatePayload) => {
      setStatus((payload.status as any) || 'waiting');
      setHostId(payload.host || null);
      setIsHost(payload.host === currentUserId);
      setParticipants(payload.participants || []);
    };

    const handleJoinFailed = ({ reason }: { reason: string }) => {
      alert(reason);
      navigate('/arena');
    };

    const handleStart = ({ arenaId }: { arenaId: string }) => {
      setIsStarting(false);
      skipLeaveRef.current = true;
      navigate(`/arena/play/${arenaId}`);
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

    // 입장
    socket.emit('arena:join', { arenaId, userId: currentUserId });

    return () => {
      // 나가기 + 핸들러 해제
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

  // 방 목록 전역 업데이트도 방 화면에서 수신해서 '나간 사람' 즉시 제거 + 동기화 요청
  useEffect(() => {
    if (!arenaId) return;

    const handleRoomUpdatedThisRoom = (updated: {
      _id: string;
      participants?: { user: string }[];
    }) => {
      if (!updated || updated._id !== arenaId) return;

      const ids = new Set((updated.participants ?? []).map(u => String(u.user)));

      // 1) 로컬에서 '없는 사람' 즉시 제거 (새로고침 없이 카드 사라짐)
      setParticipants(prev => prev.filter(p => {
        const uid = typeof p.user === 'string' ? p.user : p.user._id;
        return ids.has(uid);
      }));

      // 2) 유저명 등 디테일 동기화(짧은 스냅샷 요청) — 서버에 'arena:sync' 핸들러 필요
      socket.emit('arena:sync', { arenaId });
    };

    socket.on('arena:room-updated', handleRoomUpdatedThisRoom);
    return () => {
      socket.off('arena:room-updated', handleRoomUpdatedThisRoom);
    };
  }, [arenaId]);


  // 준비 토글
  const toggleReady = () => {
    if (!arenaId || !currentUserId) return;
    if (status !== 'waiting') return;
    const next = !(myParticipant?.isReady ?? false);
    socket.emit('arena:ready', { arenaId, userId: currentUserId, ready: next });
  };

  return (
    <Main>
      <div className="battle-cyber-container room-variant">
        <div className="background-grid"></div>
        <div className="cyber-module">
          <h1 className="cyber-title" data-text={arenaName}>{arenaName}</h1>
          
          {isStarting && (
            <div className="starting-overlay">
              <div className="starting-message">
                <div className="loader-spinner"></div>
                <h2>게임 준비 중...</h2>
                <p>곧 게임이 시작됩니다</p>
              </div>
            </div>
          )}

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
                onClick={() => { setIsStarting(true); socket.emit('arena:start', { arenaId, userId: currentUserId }); }}
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