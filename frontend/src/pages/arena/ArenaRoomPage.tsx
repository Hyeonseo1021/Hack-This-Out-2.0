import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import Main from '../../components/main/Main';
import { getArenaById } from '../../api/axiosArena';
import '../../assets/scss/arena/ArenaRoomPage.scss';

const ArenaRoomPage = () => {
  const { id: arenaId } = useParams();
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId')!;

  const [arena, setArena] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const fetchArena = async () => {
      try {
        const data = await getArenaById(arenaId!);
        setArena(data);
        setParticipants(data.participants);
      } catch (err) {
        alert('해당 아레나를 불러올 수 없습니다.');
        navigate('/arena');
      }
    };

    fetchArena();
  }, [arenaId]);

  useEffect(() => {
    if (!arenaId || !userId) return;

    socket.emit('arena:join', { arenaId, userId });

    socket.on('arena:update-participants', setParticipants);
    socket.on('arena:deleted', ({ arenaId: deleted }) => {
      if (deleted === arenaId) {
        alert('방이 삭제되었습니다.');
        navigate('/arena');
      }
    });

    return () => {
      socket.off('arena:update-participants');
      socket.off('arena:deleted');
    };
  }, [arenaId, userId]);

  const toggleReady = () => {
    const next = !isReady;
    setIsReady(next);
    socket.emit('arena:ready', { arenaId, userId, isReady: next });
  };

  const handleStart = () => {
    socket.emit('arena:start', { arenaId, userId });
  };

  if (!arena) return <div className="arena-room">로딩 중...</div>;

  const isHost = arena.host === userId;

  return (
    <Main>
    <div className="arena-room">
      <h2 className="arena-title">{arena.name}</h2>
      <div className="arena-status">상태: {arena.status}</div>

      <div className="participants-list">
        {participants.map((p, index) => (
          <div key={p.user} className={`participant ${p.isReady ? 'ready' : ''}`}>
            <span>👤 {p.user}</span>
            <span>{p.isReady ? '✅ Ready' : '⏳ Not Ready'}</span>
          </div>
        ))}
      </div>

      <div className="arena-actions">
        <button className="btn ready-btn" onClick={toggleReady}>
          {isReady ? '준비 취소' : '준비하기'}
        </button>
        {isHost && (
          <button className="btn start-btn" onClick={handleStart}>
            게임 시작
          </button>
        )}
      </div>
    </div>
    </Main>
  );
};

export default ArenaRoomPage;