import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import Main from '../../components/main/Main';
import { getArenaById } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaRoomPage.scss';

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
  const [loading, setLoading] = useState(true); // 추가: 로딩 상태
  const skipLeaveRef = useRef(false);

  const activeParticipants = useMemo(() => participants.filter(p => !p.hasLeft), [participants]);

  // 본인 정보
  const myParticipant = useMemo(
    () => activeParticipants.find(p => (typeof p.user === 'string' ? p.user : p.user._id) === currentUserId),
    [activeParticipants, currentUserId]
  );

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

  // 초기 데이터 로드
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

  // 소켓 이벤트
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

  // 디버깅 정보 출력
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

  // 로딩 중
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

          {/* 디버그 정보 (개발 중에만 표시) */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{ 
              background: '#222', 
              padding: '10px', 
              margin: '10px 0', 
              fontSize: '12px',
              color: '#0f0',
              fontFamily: 'monospace'
            }}>
              <div>Current User: {currentUserId || 'null'}</div>
              <div>Host: {hostId || 'null'}</div>
              <div>Status: {status}</div>
              <div>Participants Count: {participants.length}</div>
              <div>Active Count: {activeParticipants.length}</div>
            </div>
          )}

          {/* 참가자가 없을 때 메시지 */}
          {activeParticipants.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px',
              color: '#666'
            }}>
              No participants yet. Waiting for players...
            </div>
          )}

          {/* 참가자 8명까지 표시 (4x2 grid) */}
          {activeParticipants.length > 0 && (
            <div className="participants-grid max-eight">
              {activeParticipants.map((p, index) => {
                const userObj = typeof p.user === 'object' ? p.user : { _id: p.user, username: `Player ${index + 1}` };
                const uid = userObj._id;
                const isMe = uid === currentUserId;
                const isUserHost = uid === hostId;

                console.log('Rendering participant:', {
                  userObj,
                  uid,
                  isMe,
                  isUserHost,
                  isReady: p.isReady
                });

                return (
                  <div
                    key={uid || index}
                    className={`participant-card ${isMe ? 'is-me' : ''} ${isUserHost ? 'is-host' : ''} ${
                      p.isReady ? 'is-ready' : ''
                    }`}
                  >
                    <div className="card-content">
                      <span className="username">{userObj.username || 'Unknown'}</span>
                      {isUserHost && <span className="host-tag">HOST</span>}
                      {isMe && <span className="me-tag">(YOU)</span>}
                      <span className="status">{p.isReady ? 'READY' : 'WAITING'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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

          {/* 추가 디버그 정보 */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{ 
              marginTop: '20px',
              padding: '10px',
              background: '#222',
              fontSize: '10px',
              color: '#0f0',
              fontFamily: 'monospace',
              maxHeight: '200px',
              overflow: 'auto'
            }}>
              <pre>{JSON.stringify({ 
                currentUserId, 
                hostId, 
                isHost,
                participants,
                activeParticipants 
              }, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </Main>
  );
};

export default ArenaRoomPage;