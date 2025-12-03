import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import socket from '../../utils/socket';
import Main from '../../components/main/Main';
import { getArenaById } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaRoomPage.scss';

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
  const { t, i18n } = useTranslation('arena');

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [arenaName, setArenaName] = useState('');
  const [mode, setMode] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [status, setStatus] = useState<'waiting' | 'started' | 'ended'>('waiting');
  const [participants, setParticipants] = useState<any[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const skipLeaveRef = useRef(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const chatMessagesEndRef = useRef<null | HTMLDivElement>(null);
  const [showStartOverlay, setShowStartOverlay] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [maxPlayers, setMaxPlayers] = useState<number>(8);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initMessage, setInitMessage] = useState('');
  const activeParticipants = useMemo(() => participants.filter(p => !p.hasLeft), [participants]);

  // Mode/Difficulty 헬퍼
  const getModeName = (mode: string) => {
    const modeKey = `modes.${mode}.title`;
    // 번역이 있으면 사용, 없으면 원래 이름 반환
    const translated = t(modeKey);
    return translated !== modeKey ? translated : mode;
  };

  const getDifficultyInfo = (diff: string) => {
    const info: Record<string, { color: string }> = {
      'EASY': { color: '#4ade80' },
      'MEDIUM': { color: '#fbbf24' },
      'HARD': { color: '#f87171' },
      'EXPERT': { color: '#a855f7' }
    };
    return info[diff] || { color: '#999' };
  };

  // 본인 정보
  const myParticipant = useMemo(
    () => activeParticipants.find(p => (typeof p.user === 'string' ? p.user : p.user._id) === currentUserId),
    [activeParticipants, currentUserId]
  );
  
  // 슬롯을 만들고, 활성 참가자로 채워넣는 로직
  const displaySlots = useMemo(() => {
    const slots = new Array(maxPlayers).fill(null);
    activeParticipants.slice(0, maxPlayers).forEach((p, index) => {
      slots[index] = p;
    });
    return slots;
  }, [activeParticipants, maxPlayers]);

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
    skipLeaveRef.current = true; // cleanup에서 중복 호출 방지
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
        setHostId(data?.host?._id || data?.host || null);
        setParticipants(data?.participants || []);
        setStatus(data?.status || 'waiting');
        setMode(data?.mode || '');
        setDifficulty(data?.difficulty || '');
        setMaxPlayers(data?.maxParticipants || 8);
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

    console.log('🔌 [ArenaRoomPage] Socket connected:', socket.connected);
    console.log('🔌 [ArenaRoomPage] Setting up event listeners for arenaId:', arenaId);

    socket.off('arena:update');
    socket.off('arena:start');
    socket.off('arena:join-failed');
    socket.off('arena:chatMessage');
    socket.off('arena:notify');
    socket.off('arena:kicked');
    socket.off('arena:initializing');
    socket.off('arena:initialized');

    socket.on('arena:update', payload => {
      console.log('🔄 [ArenaRoomPage] arena:update received:', payload);
      if (payload.arenaId !== arenaId) {
        console.log('⚠️ [ArenaRoomPage] arenaId mismatch:', payload.arenaId, arenaId);
        return;
      }

      setStatus(payload.status || 'waiting');
      setHostId(payload.host || null);
      setParticipants(payload.participants || []);
      console.log('👥 [ArenaRoomPage] Updated participants:', payload.participants);
      if (payload.name) {
        setArenaName(payload.name);
      }
      if (payload.mode) setMode(payload.mode);
      if (payload.difficulty) setDifficulty(payload.difficulty);
      if (payload.maxParticipants) setMaxPlayers(payload.maxParticipants);
    });

    socket.on('arena:initializing', ({ message }: { message: string }) => {
      console.log('⏳ [ArenaRoomPage] arena:initializing:', message);
      setIsInitializing(true);
      setInitMessage(message);
    });

    socket.on('arena:initialized', () => {
      console.log('✅ [ArenaRoomPage] arena:initialized');
      setIsInitializing(false);
      setInitMessage('');
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

    socket.on('arena:notify', (payload: { type: 'system', message: string | { ko: string; en: string } }) => {
      console.log('📢 [ArenaRoomPage] arena:notify received:', payload);
      // 다국어 메시지 지원
      const lang = i18n.language as 'ko' | 'en';
      const messageText = typeof payload.message === 'object'
        ? (payload.message[lang] || payload.message.en || payload.message.ko)
        : payload.message;

      setChatMessages(prev => [...prev, {
        type: payload.type,
        message: messageText,
        senderName: 'SYSTEM',
        timestamp: new Date().toISOString()
      }]);
    });

    socket.on('arena:kicked', ({ reason }: { reason: string }) => {
      alert(reason);
      skipLeaveRef.current = true;
      navigate('/arena');
    });

    console.log('📡 [ArenaRoomPage] Emitting arena:join...', { arenaId, userId: currentUserId });
    socket.emit('arena:join', { arenaId, userId: currentUserId });

    return () => {
      if (!skipLeaveRef.current) {
        socket.emit('arena:leave', { arenaId, userId: currentUserId });
      }
      socket.off('arena:update');
      socket.off('arena:start');
      socket.off('arena:join-failed');
      socket.off('arena:chatMessage');
      socket.off('arena:notify');
      socket.off('arena:kicked');
      socket.off('arena:initializing');
      socket.off('arena:initialized');
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

  const diffInfo = getDifficultyInfo(difficulty);

  return (
    <Main>
      {/* 초기화 로딩 오버레이 */}
      {isInitializing && (
        <div className="game-start-overlay initializing">
          <div className="start-overlay-content">
            <div className="loading-spinner-large"></div>
            <div className="start-title">INITIALIZING</div>
            <div className="start-subtitle">{initMessage || '게임 환경을 준비 중입니다...'}</div>
          </div>
        </div>
      )}

      {/* 게임 시작 오버레이 */}
      {showStartOverlay && (
        <div className="game-start-overlay">
          <div className="start-overlay-content">
            <div className="start-title">{(i18n.language === 'ko' ? '게임 시작' : 'GAME STARTING').toUpperCase()}</div>
            {countdown > 0 ? (
              <div className="countdown-number">{countdown}</div>
            ) : (
              <div className="countdown-go">{i18n.language === 'ko' ? '시작!' : 'GO!'}</div>
            )}
            <div className="start-subtitle">{i18n.language === 'ko' ? '전투 준비...' : 'Prepare for battle...'}</div>
          </div>
        </div>
      )}
      <div className="battle-cyber-container room-variant">
        <div className="background-grid"></div>

        <div className="cyber-module">
          {/* 헤더에 Mode/Difficulty 추가 */}
          <div className="arena-header-info">
            <h1 className="cyber-title" data-text={arenaName}>
              {arenaName}
            </h1>
            {mode && (
              <div className="arena-metadata">
                <span className="mode-badge">{getModeName(mode)}</span>
                {difficulty && (
                  <span
                    className="difficulty-badge"
                    style={{
                      color: diffInfo.color,
                      borderColor: diffInfo.color
                    }}
                  >
                    {t(`difficulties.${difficulty}`)}
                  </span>
                )}
                <span className="participant-count-badge">
                  {activeParticipants.length} / {maxPlayers} {(i18n.language === 'ko' ? '플레이어' : 'PLAYERS').toUpperCase()}
                </span>
              </div>
            )}
          </div>

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
                          <span className="player-slot">{(i18n.language === 'ko' ? '플레이어' : 'PLAYER').toUpperCase()} {index + 1}</span>
                          <span className="username">{username}</span>
                        </div>
                        <div className="player-status">
                          {isUserHost && <span className="host-tag">{i18n.language === 'ko' ? '호스트' : 'HOST'}</span>}
                          {isMe && !isUserHost && <span className="me-tag">({i18n.language === 'ko' ? '나' : 'YOU'})</span>}
                          {!isUserHost && (
                            <span className="status">{p.isReady ? t('ready') : t('waiting')}</span>
                          )}
                        </div>

                        {/* 강퇴 버튼 */}
                        {isHost && !isMe && status === 'waiting' && (
                          <button className="cyber-button kick-btn" onClick={() => handleKick(uid, username)}>
                            {i18n.language === 'ko' ? '강퇴' : 'KICK'}
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
                          <span className="player-slot">{(i18n.language === 'ko' ? '플레이어' : 'PLAYER').toUpperCase()} {index + 1}</span>
                          <span className="username">... {i18n.language === 'ko' ? '플레이어 대기 중' : 'WAITING FOR PLAYER'} ...</span>
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
                      // IME 조합 중이면 무시 (한글 입력 시 중복 방지)
                      if (e.nativeEvent.isComposing) return;
                      if (e.key === 'Enter' && currentMessage.trim()) {
                        handleSendMessage();
                      }
                    }}
                    placeholder={i18n.language === 'ko' ? '메시지 입력...' : 'Type a message...'}
                    disabled={status !== 'waiting'}
                  />
                  <button className="cyber-button" onClick={handleSendMessage} disabled={!currentMessage.trim() || status !== 'waiting'}>
                    {i18n.language === 'ko' ? '전송' : 'SEND'}
                  </button>
                </div>
              </div>

              <div className="footer-actions">
                {isHost ? (
                  <button className="cyber-button start-btn" disabled={!everyoneExceptHostReady || isStarting || status !== 'waiting'} onClick={handleStart}>
                    {isStarting
                      ? (i18n.language === 'ko' ? '시작 중...' : 'STARTING...')
                      : t('startGame').toUpperCase()
                    }
                  </button>
                ) : (
                  <button className={`cyber-button ${myParticipant?.isReady ? 'is-ready-button' : ''}`} disabled={status !== 'waiting'} onClick={toggleReady}>
                    {myParticipant?.isReady
                      ? (i18n.language === 'ko' ? '취소' : 'CANCEL')
                      : t('ready').toUpperCase()
                    }
                  </button>
                )}
                <button className="cyber-button leave-btn" onClick={handleLeave}>
                  {t('leave').toUpperCase()}
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