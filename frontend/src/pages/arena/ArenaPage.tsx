import React, { useEffect, useState } from 'react';
import Main from '../../components/main/Main';
import { useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import { getArenaList } from '../../api/axiosArena';
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

  const handleEnterArena = (arenaId: string) => {
    const arena = arenas.find(a => a._id === arenaId);
    
    if (!arena) {
      console.log('[handleEnterArena] Arena not found:', arenaId);
      return;
    }

    const canEnter = 
      (arena.status === 'waiting' || arena.status === 'started') && 
      arena.activeParticipantsCount < arena.maxParticipants;

    if (canEnter) {
      console.log('[handleEnterArena] Entering arena:', arenaId);
      navigate(`/arena/${arenaId}`);
    } else {
      console.log('[handleEnterArena] Cannot enter room:', {
        arenaId,
        status: arena.status,
        participants: arena.activeParticipantsCount,
        maxParticipants: arena.maxParticipants
      });
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
      <div className="blueprint-container">
        <div className="blueprint-container__scanline"></div>

        {/* 좌측: 아레나 리스트 패널 */}
        <div className="blueprint-panel blueprint-panel--list">
          <div className="blueprint-panel__header">
            <h2 className="blueprint-panel__title">ARENA LIST</h2>
          </div>
          <div className="blueprint-panel__body">
            <div className="arena-list">
              <div className="arena-list__row arena-list__row--header">
                <div className="arena-list__col">ID</div>
                <div className="arena-list__col">ROOM NAME</div>
                <div className="arena-list__col">MODE</div>
                <div className="arena-list__col">PARTICIPATIONS</div>
                <div className="arena-list__col">STATUS</div>
              </div>
              {loading ? (
                <p className="arena-list__message">SYSTEM SCANNING...</p>
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
                      <div className="arena-list__col" data-label="Room Name">
                        {arena.name}
                      </div>
                      <div className="arena-list__col" data-label="Mode">
                        {arena.mode}
                      </div>
                      <div className="arena-list__col" data-label="Participations">
                        {arena.activeParticipantsCount} / {arena.maxParticipants}
                      </div>
                      <div className="arena-list__col" data-label="Status">
                        <span className={`status-badge status-badge--${isFull ? 'full' : arena.status}`}>
                          {isFull && arena.status === 'waiting' ? 'FULL' : arena.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="arena-list__message">NO SIGNAL DETECTED</p>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 방 만들기 패널 */}
        <div className="blueprint-panel blueprint-panel--create">
          <div className="blueprint-panel__header">
            <h2 className="blueprint-panel__title">NEW CONNECTION</h2>
          </div>
          <div className="blueprint-panel__body blueprint-panel__body--center">
            <button className="blueprint-button" onClick={() => navigate('/arena/create')}>
              <span className="blueprint-button__text">CREATE ROOM</span>
            </button>
            <p className="blueprint-panel__subtext">Create a new arena</p>
          </div>
        </div>
      </div>
    </Main>
  );
};

export default ArenaPage;