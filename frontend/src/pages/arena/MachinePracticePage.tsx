import React, { useEffect, useState } from 'react';
import Main from '../../components/main/Main';
import { useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import { getArenaList } from '../../api/axiosArena';
import '../../assets/scss/arena/MachinePracticePage.scss';

interface Arena {
  _id: string;
  name: string;
  category: string;
  difficulty: string;
  participants: { user: string; isReady: boolean; hasLeft: boolean }[];
  maxParticipants: number;
  status: string;
}

const MachinePracticePage: React.FC = () => {
  const navigate = useNavigate();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);

  // 설명이 누적됨 → [1], [1,2], [1,2,3]
  const [stepsShown, setStepsShown] = useState<number[]>([]);

  const annotations = [
    {
      id: 1,
      top: "50px",
      left: "300px",
      text: "ARENA LIST — 현재 생성된 대기방 목록"
    },
    {
      id: 2,
      top: "280px",
      left: "1400px",
      text: "NEW CONNECTION — 새 방 생성 패널"
    },
    {
      id: 3,
      top: "520px",
      left: "580px",
      text: "STATUS — WAITING / STARTED / ENDED 표시"
    }
  ];

  // 🔥 클릭 시 다음 번호가 하나씩 추가됨
  const handlePageClick = () => {
    setStepsShown(prev => {
      const next = prev.length + 1;
      if (next > 3) return prev; // 3 이상은 더 추가 안 함
      return [...prev, next];
    });
  };

  // Arena 기능 — 기존 그대로
  useEffect(() => {
    const loadArenaList = async () => {
      try {
        const data = await getArenaList();
        setArenas(Array.isArray(data) ? data : []);
      } catch {
        setArenas([]);
      } finally {
        setLoading(false);
      }
    };
    loadArenaList();
  }, []);

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

useEffect(() => {
  const handleListUpdate = (updatedArenas: Arena[]) => {
    setArenas(Array.isArray(updatedArenas) ? updatedArenas : []);
  };

  socket.on('arena:list-update', handleListUpdate);

  return () => {
    socket.off('arena:list-update', handleListUpdate);
  };
}, []);


  useEffect(() => {
    const handleRoomUpdated = (updated: any) => {
      setArenas(prev => {
        const idx = prev.findIndex(a => a._id === updated._id);
        if (idx === -1) return prev;

        if (updated.status === 'ended') {
          setTimeout(() => {
            setArenas(prev2 => prev2.filter(a => a._id !== updated._id));
          }, 3000);
        }

        const next = [...prev];
        next[idx] = { ...next[idx], ...updated };
        return next;
      });
    };

    socket.on('arena:room-updated', handleRoomUpdated);
    return () => {
      socket.off('arena:room-updated', handleRoomUpdated);
    };
  }, []);

  const handleEnterArena = (arenaId: string) => {
    const exists = arenas.find(a => a._id === arenaId && a.status !== 'ended');
    if (exists) navigate(`/arena/${arenaId}`);
  };

  const sortedArenas = [...arenas].sort((a, b) => {
    if (a.status === 'waiting' && b.status !== 'waiting') return -1;
    if (a.status !== 'waiting' && b.status === 'waiting') return 1;
    return 0;
  });

  return (
    <Main>
      <div className="arena-page-wrapper" onClick={handlePageClick}>

        {/* 🔥 뒤 화면 반투명 dimming overlay */}
        {stepsShown.length > 0 && <div className="dim-overlay"></div>}

        {/* 🔥 클릭할 때마다 누적되는 설명 */}
        {stepsShown.map(step => {
          const a = annotations[step - 1];
          return (
            <div
              key={step}
              className="annotation"
              style={{ top: a.top, left: a.left }}
            >
              <div className="annotation-number">{step}</div>
              <div className="annotation__label">{a.text}</div>
            </div>
          );
        })}

        {/* Arena UI 원본 */}
        <div className="blueprint-container">
          <div className="blueprint-container__scanline"></div>

          <div className="blueprint-panel blueprint-panel--list">
            <div className="blueprint-panel__header">
              <h2 className="blueprint-panel__title">ARENA LIST</h2>
            </div>

            <div className="blueprint-panel__body">
              <div className="arena-list">

                <div className="arena-list__row arena-list__row--header">
                  <div className="arena-list__col">ID</div>
                  <div className="arena-list__col">ROOM NAME</div>
                  <div className="arena-list__col">PARTICIPATIONS</div>
                  <div className="arena-list__col">STATUS</div>
                </div>

                {loading ? (
                  <p className="arena-list__message">SYSTEM SCANNING...</p>
                ) : sortedArenas.length > 0 ? (
                  sortedArenas.map((arena, index) => (
                    <div
                      key={arena._id}
                      className={`arena-list__row ${arena.status !== 'waiting' ? 'arena-list__row--locked' : ''}`}
                      onClick={() => handleEnterArena(arena._id)}
                    >
                      <div className="arena-list__col">
                        {`#${(index + 1).toString().padStart(4, '0')}`}
                      </div>
                      <div className="arena-list__col">{arena.name}</div>
                      <div className="arena-list__col">
                        {(arena.participants ?? []).filter(p => !p.hasLeft).length} / {arena.maxParticipants}
                      </div>
                      <div className="arena-list__col">
                        <span className={`status-badge status-badge--${arena.status}`}>
                          {arena.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="arena-list__message">NO SIGNAL DETECTED</p>
                )}
              </div>
            </div>
          </div>

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
      </div>
    </Main>
  );
};

export default MachinePracticePage;
