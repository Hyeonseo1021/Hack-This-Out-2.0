import React, { useEffect, useState } from 'react';
import Main from '../../components/main/Main';
import { useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import { getArenaList } from '../../api/axiosArena'; // API 함수 import
import '../../assets/scss/arena/ArenaPage.scss';

// 1. API 응답 및 소켓 이벤트에 맞춘 새 인터페이스
// (getArenas 컨트롤러가 'activeParticipantsCount'를 반환함)
interface ArenaSummary {
  _id: string;
  name: string;
  mode: string;
  maxParticipants: number;
  status: 'waiting' | 'started' | 'ended';
  activeParticipantsCount: number; // 'participants' 배열 대신 '활성 인원 수'를 직접 받음
}

const ArenaPage: React.FC = () => {
  const navigate = useNavigate();
  // 2. State가 새 인터페이스를 사용하도록 변경
  const [arenas, setArenas] = useState<ArenaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  
  // 3. 초기 데이터 로드 + 소켓 연결 시 재로드
  useEffect(() => {
    const fetchArenas = async () => {
      try {
        const data = await getArenaList();
        setArenas(Array.isArray(data) ? data : []);
      } catch {
        setArenas([]);
      } finally {
        setLoading(false);
      }
    };

    // 최초 로드
    fetchArenas();

    // 소켓 연결 완료 시 목록 재로드
    const handleConnect = () => {
      console.log('Socket connected, refreshing arena list');
      fetchArenas();
    };

    // 소켓이 이미 연결되어 있으면 즉시 로드
    if (socket.connected) {
      fetchArenas();
    }

    socket.on('connect', handleConnect);

    return () => {
      socket.off('connect', handleConnect);
    };
  }, []);

  // 4. 소켓 이벤트 구독 (로직 단순화)
  useEffect(() => {
    
    // 'arena:room-updated' 이벤트 핸들러 (방 생성/인원 변경/상태 변경)
    const handleRoomUpdated = (updatedArena: ArenaSummary) => {
      // API 응답과 동일한 activeParticipantsCount가 온다고 가정
      
      setArenas(prev => {
        // 방이 종료되었거나 활성 유저가 0명이면 목록에서 제거
        if (updatedArena.status === 'ended' || updatedArena.activeParticipantsCount === 0) {
          return prev.filter(a => a._id !== updatedArena._id);
        }

        const exists = prev.some(a => a._id === updatedArena._id);
        
        if (exists) {
          // 이미 있으면, 정보 업데이트
          return prev.map(a => a._id === updatedArena._id ? updatedArena : a);
        } else {
          // 목록에 없으면 (새 방), 새로 추가 (단, 'waiting' 상태일 때만)
          if (updatedArena.status === 'waiting') {
            return [updatedArena, ...prev];
          }
          return prev;
        }
      });
    };

    // 'arena:room-deleted' 이벤트 핸들러 (방 폭파)
    const handleRoomDeleted = (arenaId: string) => {
      setArenas(prev => prev.filter(a => a._id !== arenaId));
    };

    // 소켓 구독
    // 'arena:new-room' 대신 'arena:room-updated'를 사용 (createArena에서 emit)
    socket.on('arena:room-updated', handleRoomUpdated);
    socket.on('arena:room-deleted', handleRoomDeleted);

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      socket.off('arena:room-updated', handleRoomUpdated);
      socket.off('arena:room-deleted', handleRoomDeleted);
    };
  }, []);

  // 5. 방 입장 핸들러 (입장 조건 검사)
  const handleEnterArena = (arenaId: string) => {
    const arena = arenas.find(a => a._id === arenaId);
    
    if (!arena) {
      console.log('Arena not found');
      return;
    }

    // waiting 상태이고 자리가 있으면 입장 가능
    // started 상태여도 자리가 있으면 입장 가능 (재접속 허용)
    const canEnter = 
      (arena.status === 'waiting' || arena.status === 'started') && 
      arena.activeParticipantsCount < arena.maxParticipants;

    if (canEnter) {
      navigate(`/arena/${arenaId}`);
    } else {
      console.log('Cannot enter room: Full or Ended.');
      // 알림 표시 (선택사항)
    }
  };

  // 6. 정렬된 방 목록 (waiting 먼저)
  const sortedArenas = [...arenas].sort((a, b) => {
    if (a.status === 'waiting' && b.status !== 'waiting') return -1;
    if (a.status !== 'waiting' && b.status === 'waiting') return 1;
    return 0; // 그 외 정렬 (예:
  });

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
                                    // 7. "방 꽉 참" 조건 추가
                                    const isFull = arena.activeParticipantsCount >= arena.maxParticipants;
                                    const isLocked = arena.status !== 'waiting' || isFull;

                                    return (
                                        <div
                                            key={arena._id}
                                            className={`arena-list__row ${isLocked ? 'arena-list__row--locked' : ''}`}
                                            onClick={() => handleEnterArena(arena._id)}
                                        >
                                            <div className="arena-list__col" data-label="ID">{`#${(index + 1).toString().padStart(4, '0')}`}</div>
                                            <div className="arena-list__col" data-label="Room Name">{arena.name}</div>
                                            <div className="arena-list__col" data-label="Mode">{arena.mode}</div>
                                            <div className="arena-list__col" data-label="Participations">
                                                {/* 8. 'activeParticipantsCount'를 직접 사용 */}
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