import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import Main from '../../components/main/Main';
import { getArenaById } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaRoomPage.scss';

// 최대 플레이어 수 정의
const MAX_PLAYERS = 8;

const ArenaRoomPage: React.FC = () => {
  const { id: arenaId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [arenaName, setArenaName] = useState('');
  const [status, setStatus] = useState<'waiting' | 'started' | 'ended'>('waiting');
  const [participants, setParticipants] = useState<any[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const skipLeaveRef = useRef(false);

  const activeParticipants = useMemo(() => participants.filter(p => !p.hasLeft), [participants]);

  // 본인 정보
  const myParticipant = useMemo(
    () => activeParticipants.find(p => (typeof p.user === 'string' ? p.user : p.user._id) === currentUserId),
    [activeParticipants, currentUserId]
  );
  
  // === [수정됨] ===
  // 8개의 슬롯을 만들고, 활성 참가자로 채워넣는 로직
  const displaySlots = useMemo(() => {
    const slots = new Array(MAX_PLAYERS).fill(null);
    activeParticipants.slice(0, MAX_PLAYERS).forEach((p, index) => {
      slots[index] = p;
    });
    return slots;
  }, [activeParticipants]);
  // ===============

  // 호스트 판별
  useEffect(() => {
    if (hostId && currentUserId) setIsHost(hostId === currentUserId);
  }, [hostId, currentUserId]);

  // 호스트 제외 전원 준비 확인
  const everyoneExceptHostReady = useMemo(() => {
    if (!hostId) return false;
    const others = activeParticipants.filter(p => {
      const uid = typeof p.user === 'string' ? p.user : p.user._id;
      return uid !== hostId;
    });
    return others.length > 0 && others.every(p => p.isReady);
  }, [activeParticipants, hostId]);

  // READY 토글
  const toggleReady = () => {
    if (!arenaId || !currentUserId || status !== 'waiting') return;
    const nextReady = !(myParticipant?.isReady ?? false);

    setParticipants(prev =>
      prev.map(p => {
        const uid = typeof p.user === 'string' ? p.user : p.user._id;
        return uid === currentUserId ? { ...p, isReady: nextReady } : p;
      })
    );

    socket.emit('arena:ready', { arenaId, userId: currentUserId, ready: nextReady });
  };

  // 호스트만 시작 가능
  const handleStart = () => {
    if (!isHost || !arenaId || !everyoneExceptHostReady) return;
    setIsStarting(true);
    socket.emit('arena:start', { arenaId, userId: currentUserId });
  };

  const handleLeave = () => {
    socket.emit('arena:leave', { arenaId, userId: currentUserId });
    navigate('/arena');
  };

  // ... (초기 데이터 로드 및 소켓 이벤트 로직은 동일) ...
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. 유저 정보 먼저 가져오기
        const userRes = await getUserStatus();
        const userId = userRes?.user?._id ?? userRes?.data?.user?._id ?? null;
        console.log('✅ Current User ID:', userId);
        setCurrentUserId(userId);

        if (!arenaId) {
          console.error('❌ Arena ID is missing');
          return;
        }

        // 2. 아레나 정보 가져오기
        const arenaRes = await getArenaById(arenaId);
        const data = arenaRes?.data || arenaRes;
        
        console.log('✅ Arena Data:', data);
        console.log('✅ Participants:', data?.participants);
        
        setArenaName(data?.name ?? 'Arena Room');
        setHostId(data?.host?._id || data?.host || null);
        setParticipants(data?.participants || []);
        setStatus(data?.status || 'waiting');
        setLoading(false);
      } catch (error) {
        console.error('❌ Error loading arena data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [arenaId]);

  useEffect(() => {
    if (!arenaId || !currentUserId) {
      console.log('⚠️ Waiting for arenaId or currentUserId...');
      return;
    }

    console.log('🔌 Setting up socket listeners for arena:', arenaId);

    // 기존 리스너 제거
    socket.off('arena:update');
    socket.off('arena:start');
    socket.off('arena:join-failed');

    socket.on('arena:update', payload => {
      console.log('📡 arena:update received:', payload);
      if (payload.arenaId !== arenaId) return;
      
      setStatus(payload.status || 'waiting');
      setHostId(payload.host || null);
      setParticipants(payload.participants || []);
    });

    socket.on('arena:start', ({ arenaId: startedId }) => {
      console.log('🎮 arena:start received:', startedId);
      if (startedId === arenaId) {
        skipLeaveRef.current = true;
        setTimeout(() => navigate(`/arena/play/${arenaId}`), 1500);
      }
    });

    socket.on('arena:join-failed', ({ reason }) => {
      console.log('❌ arena:join-failed:', reason);
      alert(reason);
      navigate('/arena');
    });

    // 아레나 입장
    console.log('🚪 Emitting arena:join...');
    socket.emit('arena:join', { arenaId, userId: currentUserId });

    return () => {
      if (!skipLeaveRef.current) {
        console.log('🚪 Leaving arena...');
        socket.emit('arena:leave', { arenaId, userId: currentUserId });
      }
      socket.off('arena:update');
      socket.off('arena:start');
      socket.off('arena:join-failed');
    };
  }, [arenaId, currentUserId, navigate]);
  
  // ... (디버깅 정보 출력 및 로딩 중 UI는 동일) ...
  useEffect(() => {
    console.log('=== ARENA ROOM STATE ===');
    console.log('Current User ID:', currentUserId);
    console.log('Host ID:', hostId);
    console.log('Is Host:', isHost);
    console.log('Status:', status);
    console.log('Participants:', participants);
    console.log('Active Participants:', activeParticipants);
    console.log('My Participant:', myParticipant);
    console.log('========================');
  }, [currentUserId, hostId, isHost, status, participants, activeParticipants, myParticipant]);

  if (loading) {
    return (
      <Main>
        <div className="battle-cyber-container room-variant">
          <div className="cyber-module">
            <h1 className="cyber-title">Loading...</h1>
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
          <h1 className="cyber-title" data-text={arenaName}>
            {arenaName}
          </h1>

          {/* === [수정됨] === */}
          {/* 참가자 8명 리스트 (세로) */}
          <div className="participant-list">
            {displaySlots.map((p, index) => {
              // (1) 참가자가 있는 슬롯
              if (p) {
                const userObj = typeof p.user === 'object' ? p.user : { _id: p.user, username: '...loading' };
                const uid = userObj._id;
                const isMe = uid === currentUserId;
                const isUserHost = uid === hostId;

                return (
                  <div
                    key={uid || index}
                    className={`participant-card ${isMe ? 'is-me' : ''} ${isUserHost ? 'is-host' : ''} ${
                      p.isReady ? 'is-ready' : ''
                    }`}
                  >
                    <div className="card-content">
                      <div className="player-info">
                        <span className="player-slot">PLAYER {index + 1}</span>
                        <span className="username">{userObj.username || 'Unknown'}</span>
                      </div>
                      <div className="player-status">
                        {isUserHost && <span className="host-tag">HOST</span>}
                        {isMe && !isUserHost && <span className="me-tag">(YOU)</span>}
                        {!isUserHost && (
                          <span className="status">{p.isReady ? 'READY' : 'WAITING'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              } 
              // (2) 빈 슬롯
              else {
                return (
                  <div key={`empty-${index}`} className="participant-card is-empty">
                    <div className="card-content">
                       <div className="player-info">
                         <span className="player-slot">PLAYER {index + 1}</span>
                         <span className="username">... WAITING FOR PLAYER ...</span>
                       </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
          {/* ================ */}


          <div className="footer-actions">
            {isHost ? (
              <button
                className="cyber-button start-btn"
                disabled={!everyoneExceptHostReady || isStarting}
                onClick={handleStart}
              >
                {isStarting ? 'STARTING...' : 'START GAME'}
              </button>
            ) : (
              <button
                className={`cyber-button ${myParticipant?.isReady ? 'is-ready-button' : ''}`}
                disabled={status !== 'waiting'}
                onClick={toggleReady}
              >
                {myParticipant?.isReady ? 'CANCEL' : 'READY'}
              </button>
            )}
            <button className="cyber-button leave-btn" onClick={handleLeave}>
              LEAVE
            </button>
          </div>
        </div>
      </div>
    </Main>
  );
};

export default ArenaRoomPage;