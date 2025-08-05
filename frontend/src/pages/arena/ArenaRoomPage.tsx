import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import Main from '../../components/main/Main';
import { getArenaById } from '../../api/axiosArena';
import '../../assets/scss/arena/ArenaRoomPage.scss';

interface Participant {
  user: {
    _id: string;
    username: string;
  };
  isReady: boolean;
  hasLeft?: boolean;
}

interface Arena {
  _id: string;
  name: string;
  host: string;
  status: string;
  participants: Participant[];
}

const ArenaRoomPage: React.FC = () => {
  const { id: arenaId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');

  const [arena, setArena] = useState<Arena | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const currentUser = useMemo(
    () => participants.find((p) => p.user._id === userId),
    [participants, userId]
  );

  const isReady = currentUser?.isReady ?? false;
  const isHost = arena?.host === userId;
  const allReady = participants.length > 0 && participants.every((p) => p.isReady);

  useEffect(() => {
    if (!arenaId) return;

    const fetchArena = async () => {
      try {
        const data = await getArenaById(arenaId);
        setArena(data);
        setParticipants(data.participants);
        console.log('arena.host:', arena?.host);
        console.log('userId:', userId);

      } catch (err) {
        alert('해당 아레나를 불러올 수 없습니다.');
        navigate('/arena');
      }
    };

    fetchArena();
  }, [arenaId, navigate]);

  useEffect(() => {
    if (!arenaId || !userId) return;

    socket.emit('arena:join', { arenaId, userId });

    const handleUpdate = (newParticipants: Participant[]) => {
      setParticipants(newParticipants);
    };

    const handleDeleted = ({ arenaId: deleted }: { arenaId: string }) => {
      if (deleted === arenaId) {
        alert('방이 삭제되었습니다.');
        navigate('/arena');
      }
    };

    socket.on('arena:update-participants', handleUpdate);
    socket.on('arena:deleted', handleDeleted);

    return () => {
      socket.off('arena:update-participants', handleUpdate);
      socket.off('arena:deleted', handleDeleted);
    };
  }, [arenaId, userId, navigate]);

  const toggleReady = () => {
    socket.emit('arena:ready', {
      arenaId,
      userId,
      isReady: !isReady,
    });
  };

  const handleStart = () => {
    socket.emit('arena:start', {
      arenaId,
      userId,
    });
  };

  if (!arena) return <div className="arena-room">로딩 중...</div>;

  return (
    <Main>
      <div className="arena-room">
        <div className="arena-frame">
          <h2 className="arena-title">{arena.name}</h2>

          <div className="participants-grid">
            {participants.map((p) => (
              <div key={p.user._id} className={`participant-card ${p.isReady ? 'ready' : ''}`}>
                <span className="username">{p.user.username}</span>
                <span className="status">{p.isReady ? 'Ready' : 'Not Ready'}</span>
              </div>
            ))}
          </div>

          <div className="action-buttons">
            {isHost ? (
              <button
                className="btn start-btn"
                onClick={handleStart}
                disabled={!allReady}
              >
                START
              </button>
            ) : (
              <button className="btn ready-btn" onClick={toggleReady}>
                {isReady ? 'CANCEL' : 'READY'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Main>
  );
};

export default ArenaRoomPage;
