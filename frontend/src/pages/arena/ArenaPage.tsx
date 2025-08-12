import React, { useEffect, useState } from 'react';
import Main from '../../components/main/Main';
import { useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import ArenaCreateButton from '../../components/arena/ArenaCreateButton';
import { getArenaList } from '../../api/axiosArena';
import '../../assets/scss/arena/ArenaPage.scss';

interface Arena {
  _id: string;
  name: string;
  category: string;
  difficulty: string;
  participants: { user: string; isReady: boolean; hasLeft: boolean }[];
  maxParticipants: number;
  status: string;
}

const ArenaPage: React.FC = () => {
  const navigate = useNavigate();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. 초기 데이터 로드
  useEffect(() => {
    (async () => {
      try {
        const data = await getArenaList();
        setArenas(Array.isArray(data) ? data : []);
      } catch {
        setArenas([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2. 소켓 이벤트 구독
  useEffect(() => {
    const handleNew = (newArena: Arena) => {
      setArenas(prev => {
        const exists = prev.some(a => a._id === newArena._id);
        return exists ? prev : [...prev, newArena];
      });
    };

    const handleDeleted = ({ arenaId }: { arenaId: string }) => {
      setArenas(prev => prev.filter(a => a._id !== arenaId));
    };

    socket.on('arena:new-room', handleNew);
    socket.on('arena:deleted', handleDeleted);

    return () => {
      socket.off('arena:new-room', handleNew);
      socket.off('arena:deleted', handleDeleted);
    };
  }, []);

  // 3. arena:list-update 소켓 이벤트 구독
  useEffect(() => {
    const handleListUpdate = (updatedArenas: Arena[]) => {
      setArenas(Array.isArray(updatedArenas) ? updatedArenas : []);
    };

    socket.on('arena:list-update', handleListUpdate);

    return () => {
      socket.off('arena:list-update', handleListUpdate);
    };
  }, []);

  // 3.5. 단일 방 요약 업데이트 구독 (참가자 수/상태 즉시 반영)
  useEffect(() => {
    const handleRoomUpdated = (updated: {
      _id: string;
      name?: string;
      category?: string;
      status?: 'waiting' | 'started' | 'ended' | string;
      maxParticipants?: number;
      participants?: { user: string; hasLeft: boolean }[]; // 서버에서 주는 최소 필드
    }) => {
      setArenas(prev => {
        const idx = prev.findIndex(a => a._id === updated._id);
        if (idx === -1) return prev; // 목록에 없으면 무시(원하면 추가 로직 가능)

        if (updated.status === 'ended') {
          setTimeout(() => {
            setArenas(prev2 => prev2.filter(a => a._id !== updated._id));
          }, 3000);
        }

        const next = [...prev];
        next[idx] = {
          ...next[idx],
          ...(updated.name !== undefined ? { name: updated.name } : {}),
          ...(updated.category !== undefined ? { category: updated.category } : {}),
          ...(updated.status !== undefined ? { status: updated.status as any } : {}),
          ...(updated.maxParticipants !== undefined ? { maxParticipants: updated.maxParticipants } : {}),
          ...(Array.isArray(updated.participants) ? { participants: updated.participants } : {}),
        } as typeof prev[number];
        return next;
      });
    };

    socket.on('arena:room-updated', handleRoomUpdated);
    return () => {socket.off('arena:room-updated', handleRoomUpdated)};
  }, []);



  // 3. 방 클릭 핸들러 (방 유효성 확인)
  const handleEnterArena = (arenaId: string) => {
    const exists = arenas.find(a => a._id === arenaId && a.status !== 'ended');
    if (exists) {
      navigate(`/arena/${arenaId}`);
    }
  };

  // 4. 정렬된 방 목록: waiting 먼저
  const sortedArenas = [...arenas].sort((a, b) => {
    if (a.status === 'waiting' && b.status !== 'waiting') return -1;
    if (a.status !== 'waiting' && b.status === 'waiting') return 1;
    return 0;
  });

  return (
    <Main>
      <div className="arena-container">
        <div className="rooms-wrapper">
          <div className="rooms-bg">
            {loading ? (
              <p>불러오는 중...</p>
            ) : (
              <div className="rooms-list">
                {/* 헤더 */}
                <div
                  className="room-card header"
                  style={{
                    fontWeight: 'bold',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'default'
                  }}
                >
                  <div className="col name">Room</div>
                  <div className="col category">Category</div>
                  <div className="col players">Players</div>
                  <div className="col status">Status</div>
                </div>

                {/* 방 목록 */}
                {sortedArenas.map(arena => (
                  <div
                    key={arena._id}
                    className={`room-card ${arena.status === 'ended' ? 'disabled' : ''}`}
                    onClick={() => handleEnterArena(arena._id)}
                    style={{
                      pointerEvents: arena.status === 'ended' ? 'none' : 'auto',
                      opacity: arena.status === 'ended' ? 0.5 : 1
                    }}
                  >
                    <div className="col name">{arena.name}</div>
                    <div className="col category">{arena.category}</div>
                    <div className="col players">
                      {(arena.participants ?? []).length} / {arena.maxParticipants}
                    </div>

                    <div className="col status">
                      {arena.status === 'ended' ? 'Closed' : arena.status}
                    </div>
                  </div>
                ))}

                {/* 빈 목록 메시지 */}
                {sortedArenas.length === 0 && (
                  <p className="no-rooms">현재 대기 중인 방이 없습니다.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 방 만들기 버튼 */}
        <div className="create-room-wrapper">
          <div className="create-room-bg">
            <ArenaCreateButton title="Create Arena" route="/arena/create" />
          </div>
        </div>
      </div>
    </Main>
  );
};

export default ArenaPage;
