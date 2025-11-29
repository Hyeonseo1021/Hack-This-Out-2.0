// src/pages/arena/ArenaPlayPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import socket from '../../utils/socket';
import { getArenaById } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaPlayPage.scss';

import TerminalRace from '../../components/arena/TerminalRace';
import ForensicsRush from '../../components/arena/ForensicsRush';
import VulnerabilityScannerRace from '../../components/arena/VulnerabilityScannerRace';
// SocialEngineering - Coming Soon
import ActivityFeed from '../../components/arena/ActivityFeed';
import InventoryModal from '../../components/inventory/InventoryModal';
import { PlayProvider, usePlayContext } from '../../contexts/PlayContext';
import { getInventory, useInventoryItem } from '../../api/axiosShop';
import { toast } from 'react-toastify';


type Participant = {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
  progress?: any;
  personalEndTime?: string | Date;
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
  const { t, i18n } = useTranslation('arena');

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [arenaName, setArenaName] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState<'waiting' | 'started' | 'ended' | string>('waiting');
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [personalEndAt, setPersonalEndAt] = useState<Date | null>(null); // 개인 종료 시간
  const [remaining, setRemaining] = useState<number>(0);
  const [mode, setMode] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [scenario, setScenario] = useState<any>(null);
  const [showInventory, setShowInventory] = useState<boolean>(false);
  const [itemUsageMap, setItemUsageMap] = useState<Map<string, string>>(new Map()); // userId -> 아이템 이모지
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [usingItemId, setUsingItemId] = useState<string | null>(null);

  // ✅ Grace period 상태 (전역적으로 관리)
  const [gracePeriodActive, setGracePeriodActive] = useState(false);
  const [gracePeriodRemaining, setGracePeriodRemaining] = useState(0);
  const gracePeriodIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const joinedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const navigatedRef = useRef(false);

  const { addBuff, setAvailableHints } = usePlayContext();

  // 게임 모드별로 사용 가능한 아이템 필터링
  const isItemUsableInMode = (itemEffect: any): boolean => {
    if (!mode || status !== 'started') return true;

    const modeEffects: Record<string, string[]> = {
      'TERMINAL_HACKING_RACE': ['freezeSeconds', 'scoreBoost'],
      'VULNERABILITY_SCANNER_RACE': ['hintCount', 'scoreBoost', 'invincibleSeconds', 'freezeSeconds'],
      'FORENSICS_RUSH': ['hintCount', 'freezeSeconds', 'invincibleSeconds', 'scoreBoost'],
      'SOCIAL_ENGINEERING': ['hintCount', 'scoreBoost'],
    };

    const allowedEffects = modeEffects[mode] || [];
    if (!itemEffect) return false;

    return !!(
      (itemEffect.hintCount && allowedEffects.includes('hintCount')) ||
      (itemEffect.freezeSeconds && allowedEffects.includes('freezeSeconds')) ||
      (itemEffect.scoreBoost && allowedEffects.includes('scoreBoost')) ||
      (itemEffect.invincibleSeconds && allowedEffects.includes('invincibleSeconds'))
    );
  };

  // 필터링된 인벤토리 아이템
  const filteredInventoryItems = inventoryItems.filter(invItem =>
    isItemUsableInMode(invItem.item?.effect)
  );

  // Mode 이름 변환 헬퍼
  const getModeName = (mode: string) => {
    const modeKey = `modes.${mode}.title`;
    const translated = t(modeKey);
    return translated !== modeKey ? translated : mode;
  };

  const getParticipantStatus = (p: Participant) => {
    if (p.hasLeft) return { text: t('play.left'), color: '#666' };

    if (status === 'waiting') {
      return p.isReady
        ? { text: t('ready'), color: '#00ff88' }
        : { text: t('waiting'), color: '#ff9500' };
    }

    if (status === 'started') {
      return { text: t('play.active'), color: '#00d4ff' };
    }

    return { text: '', color: '#666' };
  };

  // 인벤토리 로드
  const fetchInventory = async () => {
    setLoadingInventory(true);
    try {
      const data = await getInventory();
      setInventoryItems(data);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoadingInventory(false);
    }
  };

  // 아이템 사용
  const handleUseItem = async (invId: string, itemData: any) => {
    setUsingItemId(invId);

    try {
      const result = await useInventoryItem(invId);
      const effect = itemData.item.effect;

      if (effect?.hintCount) {
        setAvailableHints(prev => prev + effect.hintCount);
        toast.success(t('toast.hintGained', { count: effect.hintCount }));
      }

      if (effect?.freezeSeconds) {
        // Arena 모드에서는 서버에 소켓 이벤트 전송
        if (socket && arenaId && currentUserId) {
          socket.emit('arena:use-item', {
            arenaId,
            userId: currentUserId,
            itemType: 'time_extension',
            value: effect.freezeSeconds
          });
          toast.success(t('toast.timeExtended', { seconds: effect.freezeSeconds }));
        }
      }

      if (effect?.scoreBoost) {
        // Arena 모드에서는 서버에 소켓 이벤트 전송
        if (socket && arenaId && currentUserId) {
          socket.emit('arena:use-item', {
            arenaId,
            userId: currentUserId,
            itemType: 'score_boost',
            value: effect.scoreBoost,
            duration: effect.scoreBoostDuration || 120 // 지속 시간(초), 기본값 120초
          });
        }
        // 클라이언트 로컬 버프도 추가 (UI 표시용)
        addBuff({ type: 'score_boost', value: effect.scoreBoost });
        toast.success(t('toast.scoreBoostApplied', { percent: effect.scoreBoost }));
      }

      if (effect?.invincibleSeconds) {
        // Arena 모드에서는 서버에 소켓 이벤트 전송
        if (socket && arenaId && currentUserId) {
          socket.emit('arena:use-item', {
            arenaId,
            userId: currentUserId,
            itemType: 'invincible',
            value: effect.invincibleSeconds
          });
        }
        // 클라이언트 로컬 버프도 추가 (UI 표시용)
        addBuff({ type: 'invincible', value: effect.invincibleSeconds });
        toast.success(t('toast.invincible', { seconds: effect.invincibleSeconds }));
      }

      // UI 업데이트
      setInventoryItems(prev => prev.map(item => {
        if (item._id === invId) {
          const newQuantity = result.remainingQuantity;
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
        }
        return item;
      }).filter(Boolean));

    } catch (err: any) {
      toast.error(err?.response?.data?.msg ?? t('toast.itemUseFailed'));
    } finally {
      setUsingItemId(null);
    }
  };

  // 초기 로드
  useEffect(() => {
    if (!arenaId) return;

    (async () => {
      
      const { user } = await getUserStatus();
      setCurrentUserId(user._id);

      const arenaData = await getArenaById(arenaId);
      console.log('📥 [ArenaPlayPage] Initial arena data:', arenaData);
      console.log('📥 [ArenaPlayPage] Initial participants:', arenaData.participants);

      // ✅ 게임이 이미 종료되었으면 result로 즉시 이동
      if (arenaData.status === 'ended') {
        navigate(`/arena/result/${arenaId}`, { replace: true });
        return;
      }

      setArenaName(arenaData.name);
      setHostId(String(arenaData.host));
      setStatus(arenaData.status);
      setMode(arenaData.mode);
      setScenario(arenaData.scenarioId || null);

      if (arenaData.startTime) setStartAt(new Date(arenaData.startTime));
      if (arenaData.endTime) setEndAt(new Date(arenaData.endTime));

      // ✅ 내 personalEndTime 찾기
      const myParticipant = arenaData.participants?.find(
        (p: any) => (typeof p.user === 'string' ? p.user : p.user._id) === user._id
      );
      if (myParticipant?.personalEndTime) {
        setPersonalEndAt(new Date(myParticipant.personalEndTime));
      } else if (arenaData.endTime) {
        setPersonalEndAt(new Date(arenaData.endTime));
      }

      setParticipants(arenaData.participants || []);

      if (!joinedRef.current) {
        joinedRef.current = true;
        const doJoin = () => socket.emit('arena:join', { arenaId, userId: user._id });
        if (socket.connected) doJoin();
        else socket.once('connect', doJoin);
      }
    })();
  }, [arenaId, navigate]);

  // 타이머 관리 (개인 타이머 우선, 없으면 전체 타이머)
  useEffect(() => {
    const effectiveEndTime = personalEndAt || endAt;

    if (!effectiveEndTime || status === 'ended') {
      setRemaining(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const tick = () => {
      // Arena 모드에서는 개인 타이머 우선, 없으면 전체 타이머
      const now = Date.now();
      const end = effectiveEndTime.getTime();
      const diff = end - now;
      setRemaining(Math.max(0, diff));

      if (diff <= 0 && status !== 'ended' && !navigatedRef.current) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        socket.emit('arena:end', { arenaId });
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
  }, [personalEndAt, endAt, status, arenaId]);

  // 소켓 이벤트
  useEffect(() => {
    const handleUpdate = (payload: ArenaUpdatePayload) => {
      console.log('📡 [ArenaPlayPage] arena:update received:', payload);
      console.log('📡 [ArenaPlayPage] participants data:', payload.participants);
      setStatus(payload.status);
      setHostId(payload.host);
      setParticipants(payload.participants || []);
      if (payload.startTime) setStartAt(new Date(payload.startTime));
      if (payload.endTime) setEndAt(new Date(payload.endTime));

      // ✅ 내 personalEndTime 업데이트
      const myParticipant = payload.participants?.find(
        (p: any) => (typeof p.user === 'string' ? p.user : p.user._id) === currentUserId
      );
      if (myParticipant?.personalEndTime) {
        setPersonalEndAt(new Date(myParticipant.personalEndTime));
      } else if (payload.endTime) {
        setPersonalEndAt(new Date(payload.endTime));
      }

      if (payload.mode) {
        setMode(payload.mode);
      } else {
        console.error('⚠️ MODE IS MISSING IN PAYLOAD!');
      }

      // ✅ 상태가 ended로 변경되면 결과 페이지로 이동
      if (payload.status === 'ended' && !navigatedRef.current) {
        navigatedRef.current = true;
        console.log('🏁 [ArenaPlayPage] Status changed to ended, navigating to result...');
        setTimeout(() => {
          navigate(`/arena/result/${arenaId}`, { replace: true });
        }, 2000); // 2초 후 이동
      }
    };

    const handleStart = (data: { arenaId: string; startTime: string; endTime: string; }) => {
      console.log('🎬 [ArenaPlayPage] arena:start received:', data);
    };

    const handleDeleted = ({ arenaId: deleted }: { arenaId: string }) => {
      console.log('🗑️ [ArenaPlayPage] arena:deleted received:', deleted);
      if (deleted === arenaId && !navigatedRef.current) {
        navigatedRef.current = true;
        navigate('/arena', { replace: true });
      }
    };

    const handleJoinFailed = ({ reason }: { reason: string }) => {
      console.error('❌ [ArenaPlayPage] arena:join-failed received:', reason);
      if (!navigatedRef.current) {
        navigatedRef.current = true;
        alert(reason);
        navigate('/arena', { replace: true });
      }
    };

    // ✅ arena:ended 이벤트 핸들러 추가
    const handleEnded = (data?: { arenaId?: string; message?: string; reason?: string }) => {
      console.log('🏁 [ArenaPlayPage] arena:ended received:', data);
      console.log('🔍 [ArenaPlayPage] navigatedRef.current:', navigatedRef.current);
      console.log('🔍 [ArenaPlayPage] Target arenaId:', data?.arenaId ?? arenaId);
      if (!navigatedRef.current) {
        navigatedRef.current = true;
        console.log('🚀 [ArenaPlayPage] Setting navigatedRef to true and navigating to result page...');
        navigate(`/arena/result/${data?.arenaId ?? arenaId}`, { replace: true });
      } else {
        console.warn('⚠️ [ArenaPlayPage] Already navigated, skipping navigation');
      }
    };

    // ✅ arena:redirect-to-results 이벤트 핸들러 추가
    const handleRedirectToResults = (data: { redirectUrl: string }) => {
      console.log('🎯 [ArenaPlayPage] arena:redirect-to-results received:', data);
      if (!navigatedRef.current) {
        navigatedRef.current = true;
        console.log('🚀 [ArenaPlayPage] Navigating to:', data.redirectUrl);
        navigate(data.redirectUrl, { replace: true });
      }
    };

    // 아이템 사용 알림 핸들러
    const handleItemUsed = (data: { userId: string; username: string; itemType: string; value: number; message: string | { ko: string; en: string } }) => {
      // 참가자 옆에 아이콘 표시 (3초간)
      let itemIcon = '🎁';
      if (data.itemType === 'time_extension') itemIcon = '⏰';
      else if (data.itemType === 'score_boost') itemIcon = '🚀';
      else if (data.itemType === 'invincible') itemIcon = '🛡️';

      setItemUsageMap(prev => {
        const newMap = new Map(prev);
        newMap.set(data.userId, itemIcon);
        return newMap;
      });

      // 다국어 메시지 처리
      const lang = i18n.language as 'ko' | 'en';
      const messageText = typeof data.message === 'object'
        ? (data.message[lang] || data.message.en || data.message.ko)
        : data.message;

      // 모든 아이템 사용 알림 표시
      toast.info(messageText, { position: 'top-center', autoClose: 3000 });

      // 3초 후 아이콘 제거
      setTimeout(() => {
        setItemUsageMap(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
      }, 3000);
    };

    // ✅ 아이템 사용 실패 핸들러
    const handleItemUseFailed = (data: { reason: string }) => {
      console.log('❌ [ArenaPlayPage] arena:use-item-failed received:', data);
      toast.error(data.reason);
      setUsingItemId(null);
    };

    // ✅ 개인 타이머 연장 핸들러
    const handlePersonalTimeExtended = (data: { userId: string; personalEndTime: string; value: number }) => {
      console.log('⏰ [ArenaPlayPage] arena:personal-time-extended received:', data);
      if (data.userId === currentUserId) {
        setPersonalEndAt(new Date(data.personalEndTime));
        toast.success(t('toast.timeExtended', { seconds: data.value }));
      }
    };

    // ✅ 유예 시간 시작 핸들러 (모든 플레이어에게 브로드캐스트됨)
    const handleGracePeriodStarted = (data: { graceMs: number; graceSec: number; message: string }) => {
      console.log('⏳ [ArenaPlayPage] arena:grace-period-started received:', data);

      setGracePeriodActive(true);
      setGracePeriodRemaining(data.graceSec);

      // 기존 인터벌 정리
      if (gracePeriodIntervalRef.current) {
        clearInterval(gracePeriodIntervalRef.current);
      }

      // 1초마다 카운트다운
      gracePeriodIntervalRef.current = setInterval(() => {
        setGracePeriodRemaining(prev => {
          if (prev <= 1) {
            if (gracePeriodIntervalRef.current) {
              clearInterval(gracePeriodIntervalRef.current);
              gracePeriodIntervalRef.current = null;
            }
            setGracePeriodActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // 토스트 알림
      toast.info(data.message || t('play.gracePeriodStarted'), {
        position: 'top-center',
        autoClose: 5000,
      });
    };

    socket.on('arena:update', handleUpdate);
    socket.on('arena:start', handleStart);
    socket.on('arena:deleted', handleDeleted);
    socket.on('arena:join-failed', handleJoinFailed);
    socket.on('arena:ended', handleEnded);
    socket.on('arena:redirect-to-results', handleRedirectToResults);
    socket.on('arena:item-used', handleItemUsed);
    socket.on('arena:use-item-failed', handleItemUseFailed);
    socket.on('arena:personal-time-extended', handlePersonalTimeExtended);
    socket.on('arena:grace-period-started', handleGracePeriodStarted); // ✅ 유예 시간 시작

    return () => {
      if (currentUserId && arenaId && !navigatedRef.current) {
        console.log('👋 [ArenaPlayPage] Emitting arena:leave...');
        socket.emit('arena:leave', { arenaId, userId: currentUserId });
      }
      // ✅ Grace period interval 정리
      if (gracePeriodIntervalRef.current) {
        clearInterval(gracePeriodIntervalRef.current);
        gracePeriodIntervalRef.current = null;
      }
      socket.off('arena:update', handleUpdate);
      socket.off('arena:start', handleStart);
      socket.off('arena:deleted', handleDeleted);
      socket.off('arena:join-failed', handleJoinFailed);
      socket.off('arena:ended', handleEnded);
      socket.off('arena:redirect-to-results', handleRedirectToResults);
      socket.off('arena:item-used', handleItemUsed);
      socket.off('arena:use-item-failed', handleItemUseFailed);
      socket.off('arena:personal-time-extended', handlePersonalTimeExtended);
      socket.off('arena:grace-period-started', handleGracePeriodStarted); // ✅ 유예 시간 시작
    };
  }, [arenaId, currentUserId, navigate, t]);

  // 게임 시작 시 인벤토리 로드
  useEffect(() => {
    if (status === 'started') {
      fetchInventory();
    }
  }, [status]);

  // 시간 포맷
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);


  const renderGameContent = () => {
    if (!mode) {
      return (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>{t('play.loadingGameMode')}</p>
        </div>
      );
    }

    console.log('✅ Rendering game with mode:', mode);

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
      case 'TERMINAL_HACKING_RACE':
        console.log('🎮 Loading Terminal Race component...');
        return <TerminalRace arena={currentArenaProps} socket={socket} currentUserId={currentUserId} participants={participants} scenario={scenario} />;

      case 'VULNERABILITY_SCANNER_RACE':
        console.log('🔍 Loading Vulnerability Scanner Race component...');
        return <VulnerabilityScannerRace arenaId={arenaId!} userId={currentUserId!} />;

      case 'FORENSICS_RUSH':
        console.log('🔎 Loading Forensics Rush component...');
        return <ForensicsRush arena={currentArenaProps} socket={socket} currentUserId={currentUserId} participants={participants} />;

      case 'SOCIAL_ENGINEERING':
        console.log('🎭 Social Engineering - Coming Soon');
        return (
          <div className="coming-soon-state" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#888',
            fontSize: '1.5rem'
          }}>
            <h2>{i18n.language === 'ko' ? '소셜 엔지니어링' : 'Social Engineering'}</h2>
            <p style={{ fontSize: '3rem', margin: '20px 0' }}>Coming Soon</p>
            <p>{i18n.language === 'ko' ? '이 모드는 곧 출시됩니다!' : 'This mode will be available soon!'}</p>
          </div>
        );

      default:
        console.error('❌ Unknown game mode:', mode);
        return (
          <div className="error-state">
            <h2>{t('play.unknownGameMode')}</h2>
            <p>{mode}</p>
          </div>
        );
    }
  };

  const activeCount = participants.filter(p => !p.hasLeft).length;

  return (
    <div className="arena-play-page">
      
      {/* 상단 헤더 */}
        <header className="arena-header">
          <div className="header-left">
            <h1 className="arena-play-title">{arenaName}</h1>
            <span className={`status-badge status-${status}`}>
              {status.toUpperCase()}
            </span>
            <span className="mode-badge">{mode ? getModeName(mode) : 'Loading...'}</span>
          </div>
          
          <div className="header-right">
            {/* ✅ Grace Period 표시 */}
            {gracePeriodActive && (
              <div className="grace-period-display">
                <div className="grace-icon">⏳</div>
                <div className="grace-info">
                  <div className="grace-label">GRACE PERIOD</div>
                  <div className="grace-time">
                    {Math.floor(gracePeriodRemaining / 60)}:{String(gracePeriodRemaining % 60).padStart(2, '0')}
                  </div>
                </div>
              </div>
            )}

            <div className="timer-display">
              <div className="timer-value">
                {mm}:{String(ss).padStart(2, '0')}
              </div>
              <div className="timer-label">
                {t('play.remaining')}
              </div>
            </div>

            <button
              className="sidebar-toggle"
              onClick={() => setShowSidebar(!showSidebar)}
              title={showSidebar ? t('play.hideSidebar') : t('play.showSidebar')}
            >
              {showSidebar ? '☰' : '☰'}
            </button>
          </div>
        </header>

        {/* 인벤토리 모달 */}
        {showInventory && (
          <InventoryModal
            onClose={() => setShowInventory(false)}
            isInGame={status === 'started'}
            socket={socket}
            arenaId={arenaId}
            userId={currentUserId || undefined}
            gameMode={mode || undefined}
          />
        )}

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
                  <h3>{t('play.players')}</h3>
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
                            {itemUsageMap.get(uid) && (
                              <span style={{ marginRight: 4, fontSize: 18 }}>{itemUsageMap.get(uid)}</span>
                            )}
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
              {status === 'started' && (
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
                  <h3>{t('play.info')}</h3>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <label>{t('play.startTime')}</label>
                    <span>{startAt ? new Date(startAt).toLocaleTimeString() : t('play.pending')}</span>
                  </div>
                  <div className="info-item">
                    <label>{t('play.duration')}</label>
                    <span>{endAt && startAt ? `${Math.round((endAt.getTime() - startAt.getTime()) / 60000)}min` : '---'}</span>
                  </div>
                </div>
              </div>

              {/* 인벤토리 섹션 */}
              {status === 'started' && (
                <div className="sidebar-section">
                  <div className="section-header">
                    <h3>{t('play.inventory')}</h3>
                    {filteredInventoryItems.length > 0 && (
                      <span className="inventory-count">{filteredInventoryItems.length}</span>
                    )}
                  </div>
                  {loadingInventory ? (
                    <div className="inventory-loading">{t('loading')}</div>
                  ) : filteredInventoryItems.length === 0 ? (
                    <div className="inventory-empty">{t('play.noItems')}</div>
                  ) : (
                    <div className="inventory-items-list">
                      {filteredInventoryItems.map((invItem) => {
                        // 다국어 지원: name이 객체인 경우 현재 언어로 선택
                        const lang = i18n.language as 'ko' | 'en';
                        const itemName = typeof invItem.item.name === 'object'
                          ? (invItem.item.name as any)[lang] || (invItem.item.name as any).ko || (invItem.item.name as any).en
                          : invItem.item.name;

                        return (
                        <div key={invItem._id} className="inventory-item-card">
                          <div className="item-icon">
                            {invItem.item.imageUrl ? (
                              <img
                                src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5001'}${invItem.item.imageUrl}`}
                                alt={itemName}
                                className="item-image"
                              />
                            ) : (
                              <span className="item-emoji">{invItem.item.icon || '🎁'}</span>
                            )}
                          </div>
                          <div className="item-details">
                            <div className="item-name">{itemName}</div>
                            <div className="item-quantity">×{invItem.quantity}</div>
                          </div>
                          <button
                            className="item-use-button"
                            onClick={() => handleUseItem(invItem._id, invItem)}
                            disabled={usingItemId === invItem._id}
                          >
                            {usingItemId === invItem._id ? '...' : t('play.use')}
                          </button>
                        </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

            </aside>
          )}

        </div>
      </div>
  );
};

/**
 * Wrap ArenaPlayPage with PlayProvider to provide context.
 */
const ArenaPlayPageWithProvider: React.FC = () => (
  <PlayProvider>
    <ArenaPlayPage />
  </PlayProvider>
);

export default ArenaPlayPageWithProvider;