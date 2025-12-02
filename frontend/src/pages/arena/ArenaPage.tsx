import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Main from '../../components/main/Main';
import { useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import { getArenaList, checkArenaParticipation } from '../../api/axiosArena';
import '../../assets/scss/arena/ArenaPage.scss';

interface ArenaSummary {
  _id: string;
  name: string;
  mode: string;
  maxParticipants: number;
  status: 'waiting' | 'started' | 'ended';
  activeParticipantsCount: number;
}

const ArenaPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('arena');
  const [arenas, setArenas] = useState<ArenaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // 초기 데이터 로드
  useEffect(() => {
    console.log('[ArenaPage] Component mounted');
    
    const fetchArenas = async () => {
      try {
        console.log('[fetchArenas] Fetching arena list...');
        const data = await getArenaList();
        console.log('[fetchArenas] Received data:', data);
        console.log('[fetchArenas] Data is array:', Array.isArray(data));
        console.log('[fetchArenas] Data length:', data?.length);
        
        setArenas(Array.isArray(data) ? data : []);
        setLoading(false);
      } catch (error) {
        console.error('[fetchArenas] Error:', error);
        setArenas([]);
        setLoading(false);
      }
    };

    // 최초 로드 (즉시 실행)
    fetchArenas();

    // 소켓 연결 완료 시 목록 재로드
    const handleConnect = () => {
      console.log('[Socket] Connected, socket.id:', socket.id);
      console.log('[Socket] Refreshing arena list...');
      fetchArenas();
    };

    // 소켓 연결 에러 처리
    const handleConnectError = (error: Error) => {
      console.error('[Socket] Connection error:', error);
    };

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);

    // 소켓이 이미 연결되어 있는지 확인
    console.log('[Socket] Initial connection status:', socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
    };
  }, []);

  // 소켓 이벤트 구독
  useEffect(() => {
    console.log('[Socket] Setting up event listeners');
    
    const handleRoomUpdated = (updatedArena: ArenaSummary) => {
      console.log('[Socket] arena:room-updated received:', updatedArena);
      
      setArenas(prev => {
        console.log('[Socket] Current arenas count:', prev.length);
        
        // 방이 종료되었거나 활성 유저가 0명이면 목록에서 제거
        if (updatedArena.status === 'ended' || updatedArena.activeParticipantsCount === 0) {
          console.log('[Socket] Removing arena (ended or empty):', updatedArena._id);
          return prev.filter(a => a._id !== updatedArena._id);
        }

        const exists = prev.some(a => a._id === updatedArena._id);
        
        if (exists) {
          // 이미 있으면 정보 업데이트
          console.log('[Socket] Updating existing arena:', updatedArena._id);
          return prev.map(a => a._id === updatedArena._id ? updatedArena : a);
        } else {
          // 목록에 없으면 새로 추가 (waiting 상태일 때만)
          if (updatedArena.status === 'waiting') {
            console.log('[Socket] Adding new arena:', updatedArena._id);
            return [updatedArena, ...prev];
          }
          console.log('[Socket] Ignoring arena (not waiting):', updatedArena._id, 'status:', updatedArena.status);
          return prev;
        }
      });
    };

    const handleRoomDeleted = (arenaId: string) => {
      console.log('[Socket] arena:room-deleted received:', arenaId);
      setArenas(prev => prev.filter(a => a._id !== arenaId));
    };

    socket.on('arena:room-updated', handleRoomUpdated);
    socket.on('arena:room-deleted', handleRoomDeleted);

    return () => {
      console.log('[Socket] Cleaning up event listeners');
      socket.off('arena:room-updated', handleRoomUpdated);
      socket.off('arena:room-deleted', handleRoomDeleted);
    };
  }, []);

  const handleEnterArena = async (arenaId: string) => {
    const arena = arenas.find(a => a._id === arenaId);

    if (!arena) {
      console.log('[handleEnterArena] Arena not found:', arenaId);
      return;
    }

    try {
      // 서버에 참가 여부 확인 요청
      const { isParticipant, hasLeft } = await checkArenaParticipation(arenaId);

      // 이미 참가 중인 경우
      if (isParticipant) {
        if (hasLeft) {
          // 나갔던 방 - 재접속 확인
          const confirmReconnect = window.confirm(
            i18n.language === 'ko'
              ? '이전에 나간 방입니다.\n다시 접속하시겠습니까?'
              : 'You previously left this room.\nWould you like to reconnect?'
          );

          if (confirmReconnect) {
            console.log('[handleEnterArena] Reconnecting to arena:', arenaId);

            // 방 상태가 "대기 중"일 때만 대기방으로 이동
            if (arena.status === 'waiting') {
              navigate(`/arena/${arenaId}`);
            } else {
              // 게임이 시작되었으면 플레이 화면으로 이동
              navigate(`/arena/play/${arenaId}`);
            }
          }
        } else {
          // 이미 참가 중 - 바로 입장
          console.log('[handleEnterArena] Already in arena, rejoining:', arenaId);
          // 게임이 시작되지 않은 경우에는 대기방으로 가야 하므로
          if (arena.status === 'waiting') {
            navigate(`/arena/${arenaId}`);
          } else {
            navigate(`/arena/play/${arenaId}`);
          }
        }
        return;
      }

      // 새로 입장하는 경우
      if (arena.status === 'waiting') {
        // 대기 중인 아레나에만 참가 가능
        if (arena.activeParticipantsCount < arena.maxParticipants) {
          console.log('[handleEnterArena] Entering new arena:', arenaId);
          navigate(`/arena/${arenaId}`); // 대기방으로 이동
        } else {
          alert(i18n.language === 'ko' ? '방이 가득 찼습니다.' : 'This room is full.');
        }
      } else if (arena.status === 'started') {
        // 게임이 시작된 경우
        alert(i18n.language === 'ko' ? '게임이 이미 시작되었습니다. 참가할 수 없습니다.' : 'This game has already started. You cannot join.');
      } else if (arena.status === 'ended') {
        // 게임이 종료된 경우
        alert(i18n.language === 'ko' ? '게임이 종료되었습니다.' : 'This game has ended.');
      }
    } catch (error) {
      console.error('[handleEnterArena] Error checking participation:', error);
      // 에러 시 대기 방으로 이동
      if (arena.status === 'waiting' && arena.activeParticipantsCount < arena.maxParticipants) {
        navigate(`/arena/${arenaId}`);
      }
    }
  };


  // 정렬된 방 목록 (waiting 먼저)
  const sortedArenas = [...arenas].sort((a, b) => {
    if (a.status === 'waiting' && b.status !== 'waiting') return -1;
    if (a.status !== 'waiting' && b.status === 'waiting') return 1;
    return 0;
  });

  console.log('[Render] Current arenas:', sortedArenas.length, 'loading:', loading);

  return (
    <Main>
      <div className="arena-container">
        {/* 좌측: 아레나 리스트 패널 */}
        <div className="blueprint-panel blueprint-panel--list">
          <div className="blueprint-panel__header">
            <h2 className="blueprint-panel__title" data-text={t('arenaList').toUpperCase()}>
              {t('arenaList').toUpperCase()}
            </h2>
          </div>
          <div className="blueprint-panel__body">
            <div className="arena-list">
              <div className="arena-list__row arena-list__row--header">
                <div className="arena-list__col">ID</div>
                <div className="arena-list__col">{t('arenaName').toUpperCase()}</div>
                <div className="arena-list__col">{t('gameMode').toUpperCase()}</div>
                <div className="arena-list__col">{t('participants').toUpperCase()}</div>
                <div className="arena-list__col">{t('status').toUpperCase()}</div>
              </div>
              {loading ? (
                <p className="arena-list__message">{t('loading').toUpperCase()}</p>
              ) : sortedArenas.length > 0 ? (
                sortedArenas.map((arena, index) => {
                  const isFull = arena.activeParticipantsCount >= arena.maxParticipants;
                  const isLocked = arena.status !== 'waiting' || isFull;

                  return (
                    <div
                      key={arena._id}
                      className={`arena-list__row ${isLocked ? 'arena-list__row--locked' : ''}`}
                      onClick={() => handleEnterArena(arena._id)}
                    >
                      <div className="arena-list__col" data-label="ID">
                        {`#${(index + 1).toString().padStart(4, '0')}`}
                      </div>
                      <div className="arena-list__col" data-label={t('arenaName')}>
                        {arena.name}
                      </div>
                      <div className="arena-list__col" data-label={t('gameMode')}>
                        {arena.mode}
                      </div>
                      <div className="arena-list__col" data-label={t('participants')}>
                        {arena.activeParticipantsCount} / {arena.maxParticipants}
                      </div>
                      <div className="arena-list__col" data-label={t('status')}>
                        <span className={`status-badge status-badge--${isFull ? 'full' : arena.status}`}>
                          {isFull && arena.status === 'waiting'
                            ? (i18n.language === 'ko' ? '가득참' : 'FULL')
                            : t(arena.status).toUpperCase()
                          }
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="arena-list__message">{t('noArenas').toUpperCase()}</p>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 방 만들기 패널 */}
        <div className="blueprint-panel blueprint-panel--create">
          <div className="blueprint-panel__header">
            <h2 className="blueprint-panel__title" data-text={t('createArena').toUpperCase()}>
              {t('createArena').toUpperCase()}
            </h2>
          </div>
          <div className="blueprint-panel__body blueprint-panel__body--center">
            <button className="blueprint-button" onClick={() => navigate('/arena/create')}>
              <span className="blueprint-button__text">{t('createArena').toUpperCase()}</span>
            </button>
            <p className="blueprint-panel__subtext">{t('createNew')}</p>
          </div>
        </div>
      </div>
    </Main>
  );
};

export default ArenaPage;