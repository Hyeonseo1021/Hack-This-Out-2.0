import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import Main from '../../components/main/Main';
import { getArenaById } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaRoomPage.scss';

type Participant = {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
};

const ArenaRoomPage: React.FC = () => {
  const { id: arenaId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [arenaName, setArenaName] = useState('');
  const [status, setStatus] = useState<'waiting' | 'started' | 'ended'>('waiting');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isStarting, setIsStarting] = useState(false);

  const joinedRef = useRef(false); // 중복 join 방지

  useEffect(() => {
    if (!arenaId) return;
    (async () => {
      const { user } = await getUserStatus();
      setCurrentUserId(user._id);

      // ✅ join emit 중복 방지
      if (!joinedRef.current) {
        joinedRef.current = true;
        if (socket.connected) {
          socket.emit('arena:join', { arenaId, userId: user._id });
        } else {
          socket.once('connect', () => {
            socket.emit('arena:join', { arenaId, userId: user._id });
          });
        }
      }

      const arenaData = await getArenaById(arenaId);
      setArenaName(arenaData.name);
      setStatus(arenaData.status);
      setHostId(arenaData.host);
      setIsHost(user._id === arenaData.host);
      setParticipants(arenaData.participants);
    })();
  }, [arenaId]);

  useEffect(() => {
    const handleJoinFailed = ({ reason }: { reason: string }) => {
      alert(reason);
      navigate('/arena');
    };

    socket.on('arena:join-failed', handleJoinFailed);

    return () => {
      // 명시적으로 void 처리
      socket.off('arena:join-failed', handleJoinFailed);
      return undefined;
    };
  }, [navigate]);

  useEffect(() => {
    const handleStart = ({
      arenaId,
      startTime,
      endTime,
    }: {
      arenaId: string;
      startTime: string;
      endTime: string;
    }) => {
      console.log('[소켓] arena:start 수신', startTime, endTime);
      navigate(`/arena/play/${arenaId}`);
    };

    socket.on('arena:start', handleStart);

    return () => {
      socket.off('arena:start', handleStart);
      return undefined;
    };
  }, [navigate]);


  useEffect(() => {
    const handleUpdate = ({
      participants: list,
      host,
      status: newStatus,
    }: {
      participants: Participant[];
      host: string;
      status: 'waiting' | 'started' | 'ended';
    }) => {
      setParticipants(list.filter(p => !p.hasLeft));
      setHostId(host);
      setIsHost(currentUserId === host);
      setStatus(newStatus);
    };

    const handleDeleted = ({ arenaId: deleted }: { arenaId: string }) => {
      if (deleted === arenaId) navigate('/arena');
    };

    socket.on('arena:update', handleUpdate);
    socket.on('arena:deleted', handleDeleted);

    return () => {
      if (currentUserId && arenaId) {
        socket.emit('arena:leave', { arenaId, userId: currentUserId });
      }
      socket.off('arena:update', handleUpdate);
      socket.off('arena:deleted', handleDeleted);
    };
  }, [arenaId, currentUserId, navigate]);

  const me = participants.find(p => {
    const uid = typeof p.user === 'string' ? p.user : p.user._id;
    return uid === currentUserId;
  });

  const amReady = me?.isReady ?? false;

  const allReady =
    participants.length > 0 &&
    participants
      .filter(p => {
        const uid = typeof p.user === 'string' ? p.user : p.user._id;
        return uid !== hostId;
      })
      .every(p => p.isReady && !p.hasLeft);

  return (
    <Main>
      <div className="arena-frame">
        <h2 className="arena-title">{arenaName}</h2>
        <div className="participants-list">
          {participants.map(p => {
            const uid = typeof p.user === 'string' ? p.user : p.user._id;
            const name = typeof p.user === 'string' ? p.user : p.user.username;
            const readyFlag = p.isReady;
            const isHostUser = uid === hostId;

            return (
              <div key={uid} className={`participant-card ${readyFlag ? 'ready' : ''}`}>
                <span className="participant-name">{name}</span>
                {isHostUser ? (
                  <span className="host-label">👑 Host</span>
                ) : (
                  <span className={`participant-status ${readyFlag ? 'ready' : 'not-ready'}`}>
                    {readyFlag ? '✅ Ready' : '❌ Not Ready'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="action-buttons">
          {isHost ? (
            <button
              className="btn start-btn"
              disabled={!allReady || isStarting}
              onClick={() => {
                if (!currentUserId || isStarting) return;
                setIsStarting(true);
                socket.emit('arena:start', { arenaId, userId: currentUserId });
              }}
            >
              게임 시작
            </button>
          ) : (
            <button
              className="btn"
              onClick={() =>
                socket.emit('arena:ready', {
                  arenaId,
                  userId: currentUserId,
                  isReady: !amReady,
                })
              }
            >
              {amReady ? '준비 취소' : '준비'}
            </button>
          )}
        </div>
      </div>
    </Main>
  );
};

export default ArenaRoomPage;
