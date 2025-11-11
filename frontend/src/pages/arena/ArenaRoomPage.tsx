import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import Main from '../../components/main/Main';
import { getArenaById } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaRoomPage.scss';

const MAX_PLAYERS = 8;

type ChatMessage = {
  type: 'chat' | 'system' | 'notification'; 
  senderId?: string;
  senderName: string; 
  message: string;
  timestamp: string;
};

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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const chatMessagesEndRef = useRef<null | HTMLDivElement>(null);
  const [tempArenaName, setTempArenaName] = useState('');
  const [showStartOverlay, setShowStartOverlay] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const activeParticipants = useMemo(() => participants.filter(p => !p.hasLeft), [participants]);

  // 본인 정보
  const myParticipant = useMemo(
    () => activeParticipants.find(p => (typeof p.user === 'string' ? p.user : p.user._id) === currentUserId),
    [activeParticipants, currentUserId]
  );
  
  // 8개의 슬롯을 만들고, 활성 참가자로 채워넣는 로직
  const displaySlots = useMemo(() => {
    const slots = new Array(MAX_PLAYERS).fill(null);
    activeParticipants.slice(0, MAX_PLAYERS).forEach((p, index) => {
      slots[index] = p;
    });
    return slots;
  }, [activeParticipants]);

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

  const handleSendMessage = () => {
    if (!currentMessage.trim() || !arenaId) return;
    socket.emit('arena:chat', { arenaId, message: currentMessage });
    setCurrentMessage('');
  };

  const handleKick = (kickedUserId: string, username: string) => {
    if (window.confirm(`정말 ${username}님을 강퇴하시겠습니까?`)) {
      socket.emit('arena:kick', { kickedUserId });
    }
  };

  const handleArenaNameChange = () => {
    if (isHost && status === 'waiting' && tempArenaName !== arenaName) {
      socket.emit('arena:settingsChange', { 
        newSettings: { name: tempArenaName } 
      });
    }
  };

  // 유저 정보와 아레나 정보를 로드하는 useEffect
  useEffect(() => {
    const loadData = async () => {
      try {
        const userRes = await getUserStatus();
        const userId = userRes?.user?._id ?? userRes?.data?.user?._id ?? null;
        setCurrentUserId(userId);

        if (!arenaId) {
          console.error('❌ Arena ID is missing');
          return;
        }

        const arenaRes = await getArenaById(arenaId);
        const data = arenaRes?.data || arenaRes;
        
        setArenaName(data?.name ?? 'Arena Room');
        setTempArenaName(data?.name ?? 'Arena Room');
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

    socket.off('arena:update');
    socket.off('arena:start');
    socket.off('arena:join-failed');
    socket.off('arena:chatMessage'); 
    socket.off('arena:notify');      
    socket.off('arena:kicked');

    socket.on('arena:update', payload => {
      if (payload.arenaId !== arenaId) return;
      
      setStatus(payload.status || 'waiting');
      setHostId(payload.host || null);
      setParticipants(payload.participants || []);
      if (payload.name) {
        setArenaName(payload.name);
        setTempArenaName(payload.name);
      }
    });

    socket.on('arena:start', ({ arenaId: startedId }) => {
      if (startedId === arenaId) {
        skipLeaveRef.current = true;
        setShowStartOverlay(true);
        setCountdown(3);
        
        const countdownInterval = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        setTimeout(() => {
          navigate(`/arena/play/${arenaId}`);
        }, 3500);
      }
    });

    socket.on('arena:join-failed', ({ reason }) => {
      alert(reason);
      navigate('/arena');
    });

    socket.on('arena:chatMessage', (payload: ChatMessage) => {
      setChatMessages(prev => [...prev, payload]);
    });

    socket.on('arena:notify', (payload: { type: 'system', message: string }) => {
      setChatMessages(prev => [...prev, {
        ...payload,
        senderName: 'SYSTEM',
        timestamp: new Date().toISOString()
      }]);
    });

    socket.on('arena:kicked', ({ reason }: { reason: string }) => {
      alert(reason);
      skipLeaveRef.current = true;
      navigate('/arena');
    });

    socket.emit('arena:join', { arenaId, userId: currentUserId });

    return () => {
      socket.emit('arena:leave', { arenaId, userId: currentUserId }); // 페이지 떠날 때 방을 나간다
      socket.off('arena:update');
      socket.off('arena:start');
      socket.off('arena:join-failed');
      socket.off('arena:chatMessage');
      socket.off('arena:notify');     
      socket.off('arena:kicked');
    };
  }, [arenaId, currentUserId, navigate]);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
      {/* 게임 시작 오버레이 */}
        {showStartOverlay && (
          <div className="game-start-overlay">
            <div className="start-overlay-content">
              <div className="start-title">GAME STARTING</div>
              {countdown > 0 ? (
                <div className="countdown-number">{countdown}</div>
              ) : (
                <div className="countdown-go">GO!</div>
              )}
              <div className="start-subtitle">Prepare for battle...</div>
            </div>
          </div>
        )}
      <div className="battle-cyber-container room-variant">
        <div className="background-grid"></div>

        <div className="cyber-module">
          <h1 className="cyber-title" data-text={arenaName}>
            {arenaName}
          </h1>

          <div className="room-content-wrapper">
            {/* 왼쪽 열: 참가자 목록 */}
            <div className="participant-list">
              {displaySlots.map((p, index) => {
                if (p) {
                  const userObj = typeof p.user === 'object' ? p.user : { _id: p.user, username: '...loading' };
                  const uid = userObj._id;
                  const username = userObj.username || 'Unknown';
                  const isMe = uid === currentUserId;
                  const isUserHost = uid === hostId;

                  return (
                    <div key={uid || index} className={`participant-card ${isMe ? 'is-me' : ''} ${isUserHost ? 'is-host' : ''} ${p.isReady ? 'is-ready' : ''}`}>
                      <div className="card-content">
                        <div className="player-info">
                          <span className="player-slot">PLAYER {index + 1}</span>
                          <span className="username">{username}</span>
                        </div>
                        <div className="player-status">
                          {isUserHost && <span className="host-tag">HOST</span>}
                          {isMe && !isUserHost && <span className="me-tag">(YOU)</span>}
                          {!isUserHost && (
                            <span className="status">{p.isReady ? 'READY' : 'WAITING'}</span>
                          )}
                        </div>

                        {/* 강퇴 버튼 */}
                        {isHost && !isMe && status === 'waiting' && (
                          <button className="cyber-button kick-btn" onClick={() => handleKick(uid, username)}>
                            강퇴
                          </button>
                        )}
                      </div>
                    </div>
                  );
                } else {
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

            {/* 오른쪽 열: 채팅 + 버튼 */}
            <div className="right-column">
              <div className="chat-module">
                <div className="chat-messages">
                  {chatMessages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.type === 'system' ? 'system-message' : ''}`}>
                      {msg.type === 'chat' && <strong>{msg.senderName}: </strong>}
                      {msg.message}
                    </div>
                  ))}
                  <div ref={chatMessagesEndRef} />
                </div>
                <div className="chat-input-area">
                  <input
                    type="text"
                    className="cyber-input"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && currentMessage.trim()) {
                        handleSendMessage();
                      }
                    }}
                    placeholder="메시지 입력..."
                    disabled={status !== 'waiting'}
                  />
                  <button className="cyber-button" onClick={handleSendMessage} disabled={!currentMessage.trim() || status !== 'waiting'}>
                    전송
                  </button>
                </div>
              </div>

              <div className="footer-actions">
                {isHost ? (
                  <button className="cyber-button start-btn" disabled={!everyoneExceptHostReady || isStarting || status !== 'waiting'} onClick={handleStart}>
                    {isStarting ? 'STARTING...' : 'START GAME'}
                  </button>
                ) : (
                  <button className={`cyber-button ${myParticipant?.isReady ? 'is-ready-button' : ''}`} disabled={status !== 'waiting'} onClick={toggleReady}>
                    {myParticipant?.isReady ? 'CANCEL' : 'READY'}
                  </button>
                )}
                <button className="cyber-button leave-btn" onClick={handleLeave}>
                  LEAVE
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Main>
  );
};

export default ArenaRoomPage;
