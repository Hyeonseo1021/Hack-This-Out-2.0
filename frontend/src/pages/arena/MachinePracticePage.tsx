import React, { useEffect, useState } from 'react';
import Main from '../../components/main/Main';
import { useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import { getArenaList, checkArenaParticipation } from '../../api/axiosArena';
import '../../assets/scss/arena/MachinePracticePage.scss';

interface ArenaSummary {
  _id: string;
  name: string;
  mode: string;
  maxParticipants: number;
  status: 'waiting' | 'started' | 'ended';
  activeParticipantsCount: number;
}

const MachinePracticePage: React.FC = () => {
  const navigate = useNavigate();
  const [arenas, setArenas] = useState<ArenaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  /* -------------------------------------------
      🔥 설명 모드: 클릭할 때마다 1 → 2 → 3 누적 표시
  ------------------------------------------- */
  const [stepsShown, setStepsShown] = useState<number[]>([]);

  const annotations = [
    { id: 1, top: "30px", left: "260px", text: "ARENA LIST — 현재 생성된 대기방 목록" },
    { id: 2, top: "260px", left: "1400px", text: "NEW CONNECTION — 새 방 생성 패널" },
    { id: 3, top: "520px", left: "580px", text: "STATUS — WAITING / STARTED / ENDED 표시" }
  ];

  const handlePageClick = () => {
    setStepsShown(prev => {
      const next = prev.length + 1;
      if (next > 3) return prev;
      return [...prev, next];
    });
  };

  /* -------------------------------------------
      🔥 Arena 데이터 로드
  ------------------------------------------- */
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

    fetchArenas();
    socket.on('connect', fetchArenas);

    return () => socket.off('connect', fetchArenas);
  }, []);

  /* -------------------------------------------
      🔥 소켓 업데이트
  ------------------------------------------- */
  useEffect(() => {
    const handleRoomUpdated = (updatedArena: ArenaSummary) => {
      setArenas(prev => {
        const exists = prev.some(a => a._id === updatedArena._id);

        if (updatedArena.status === 'ended' || updatedArena.activeParticipantsCount === 0) {
          return prev.filter(a => a._id !== updatedArena._id);
        }

        return exists
          ? prev.map(a => a._id === updatedArena._id ? updatedArena : a)
          : updatedArena.status === 'waiting' ? [updatedArena, ...prev] : prev;
      });
    };

    const handleRoomDeleted = (arenaId: string) => {
      setArenas(prev => prev.filter(a => a._id !== arenaId));
    };

    socket.on('arena:room-updated', handleRoomUpdated);
    socket.on('arena:room-deleted', handleRoomDeleted);

    return () => {
      socket.off('arena:room-updated', handleRoomUpdated);
      socket.off('arena:room-deleted', handleRoomDeleted);
    };
  }, []);

  const handleEnterArena = async (arenaId: string) => {
    const arena = arenas.find(a => a._id === arenaId);
    if (!arena) return;

    const { isParticipant } = await checkArenaParticipation(arenaId);

    if (isParticipant) {
      navigate(arena.status === 'waiting' ? `/arena/${arenaId}` : `/arena/play/${arenaId}`);
      return;
    }

    if (arena.status === 'waiting' && arena.activeParticipantsCount < arena.maxParticipants) {
      navigate(`/arena/${arenaId}`);
    } else {
      alert('This room is not available.');
    }
  };

  const sortedArenas = [...arenas].sort((a, b) =>
    a.status === 'waiting' && b.status !== 'waiting' ? -1 :
    a.status !== 'waiting' && b.status === 'waiting' ? 1 : 0
  );

  /* -------------------------------------------
      🔥 UI 렌더링
  ------------------------------------------- */
  return (
    <Main>
      <div className="arena-page-wrapper" onClick={handlePageClick}>

        {/* 튜토리얼 클릭 레이어 */}
        {stepsShown.length < 3 && (
          <div className="tutorial-click-layer"></div>
        )}

        {/* 반투명 오버레이 */}
        {stepsShown.length > 0 && (
          <div className="dim-overlay"></div>
        )}

        {/* 말풍선 */}
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

        {/* 기존 ArenaPanel */}
        <div className="blueprint-container">
          <div className="blueprint-container__scanline"></div>

          {/* LEFT */}
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
                ) : sortedArenas.length === 0 ? (
                  <p className="arena-list__message">NO SIGNAL DETECTED</p>
                ) : (
                  sortedArenas.map((arena, index) => (
                    <div
                      key={arena._id}
                      className={`arena-list__row ${arena.status !== 'waiting' ? 'arena-list__row--locked' : ''}`}
                      onClick={() => handleEnterArena(arena._id)}
                    >
                      <div className="arena-list__col">#{String(index + 1).padStart(4, '0')}</div>
                      <div className="arena-list__col">{arena.name}</div>
                      <div className="arena-list__col">{arena.mode}</div>
                      <div className="arena-list__col">
                        {arena.activeParticipantsCount} / {arena.maxParticipants}
                      </div>
                      <div className="arena-list__col">
                        <span className={`status-badge status-badge--${arena.status}`}>
                          {arena.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT */}
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
