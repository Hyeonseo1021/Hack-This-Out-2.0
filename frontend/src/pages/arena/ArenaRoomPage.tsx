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

  const [arena, setArena] = useState<Arena | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // arena 정보 불러오기
  useEffect(() => {
    if (!arenaId) return;

    const fetchArena = async () => {
      try {
        const data = await getArenaById(arenaId);
        setArena(data);
        setParticipants(data.participants);
      } catch (err) {
        alert('해당 아레나를 불러올 수 없습니다.');
        navigate('/arena');
      }
    };

    fetchArena();
  }, [arenaId, navigate]);

  // 소켓 이벤트 등록
  useEffect(() => {
    if (!arenaId) return;

    console.log('📤 socket.emit("arena:join") 실행됨:', arenaId);
    socket.emit('arena:join', { arenaId });

    const handleUpdate = (newParticipants: Participant[]) => {
      console.log('📥 participants 업데이트 수신됨:', newParticipants);
      setParticipants(newParticipants);
    };

    const handleDeleted = ({ arenaId: deleted }: { arenaId: string }) => {
      if (deleted === arenaId) {
        alert('방이 삭제되었습니다.');
        navigate('/arena');
      }
    };

    const handleSelfId = ({ userId }: { userId: string }) => {
      console.log('✅ socket.on("arena:self-id") 수신:', userId);
      setCurrentUserId(userId);
    };

    socket.on('arena:self-id', handleSelfId);
    socket.on('arena:update-participants', handleUpdate);
    socket.on('arena:deleted', handleDeleted);

    return () => {
      socket.off('arena:self-id', handleSelfId);
      socket.off('arena:update-participants', handleUpdate);
      socket.off('arena:deleted', handleDeleted);
    };
  }, [arenaId, navigate]);

  const currentUser = useMemo(() => {
    return participants.find((p) => String(p.user._id) === String(currentUserId));
  }, [participants, currentUserId]);

  const isReady = currentUser?.isReady ?? false;

  const isHost = useMemo(() => {
    if (!arena || !currentUserId) return false;
    return String(arena.host) === String(currentUserId);
  }, [arena, currentUserId]);

  const allReady = useMemo(() => {
    return participants.length > 0 && participants.every((p) => p.isReady);
  }, [participants]);

  const toggleReady = () => {
    if (!arenaId || !currentUserId) return;
    socket.emit('arena:ready', {
      arenaId,
      userId: currentUserId,
      isReady: !isReady,
    });
  };

  const handleStart = () => {
    if (!arenaId || !currentUserId) return;
    socket.emit('arena:start', {
      arenaId,
      userId: currentUserId,
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
              <button className="btn start-btn" onClick={handleStart} disabled={!allReady}>
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
