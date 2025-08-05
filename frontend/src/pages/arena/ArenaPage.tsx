// src/pages/arena/ArenaPage.tsx
import React, { useEffect, useState } from 'react';
import Main from '../../components/main/Main';
import { useNavigate } from 'react-router-dom';
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

const ArenaPage = () => {
  const navigate = useNavigate();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArenas = async () => {
      try {
        const data = await getArenaList();
        if (Array.isArray(data)) {
          setArenas(data);
        } else {
          console.warn('Invalid arena data:', data);
          setArenas([]);
        }
      } catch (err) {
        console.error('Failed to fetch arena list:', err);
        setArenas([]);
      } finally {
        setLoading(false);
      }
    };

    fetchArenas();
  }, []);

  const handleEnterArena = (arenaId: string) => {
    navigate(`/arena/${arenaId}`);
  };

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
                <div className="room-card" style={{ fontWeight: 'bold', background: 'transparent', border: 'none', cursor: 'default' }}>
                  <div className="col name">Room</div>
                  <div className="col category">Category</div>
                  <div className="col players">Players</div>
                  <div className="col status">Status</div>
                </div>

                {/* 데이터 */}
                {arenas.map((arena) => (
                  <div
                    key={arena._id}
                    className="room-card"
                    onClick={() => handleEnterArena(arena._id)}
                  >
                    <div className="col name">{arena.name}</div>
                    <div className="col category">{arena.category}</div>
                    <div className="col players">{arena.participants.length} / {arena.maxParticipants}</div>
                    <div className="col status">{arena.status}</div>
                  </div>
                ))}
              </div>

            )}
          </div>
        </div>

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
