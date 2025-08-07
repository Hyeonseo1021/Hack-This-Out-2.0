import React, { useEffect, useState } from 'react';
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
  startTime?: Date;
  endTime?: Date;
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

  // 1) 초기화: 유저 상태 가져오고 join → 초기 API 로드
  useEffect(() => {
    if (!arenaId) return;
    (async () => {
      const { user } = await getUserStatus();
      console.log('user status:', user);
      setCurrentUserId(user._id);

      // 소켓 방 입장
      console.log('socket.emit join', arenaId, user._id);
      if (socket.connected) {
        socket.emit('arena:join', { arenaId, userId: user._id });
      } else {
        socket.once('connect', () => {
          socket.emit('arena:join', { arenaId, userId: user._id });
        });
      }


      // 초기 아레나 정보
      const arenaData = await getArenaById(arenaId);
      setArenaName(arenaData.name);
      setStatus(arenaData.status);
      setHostId(arenaData.host);
      setIsHost(user._id === arenaData.host);
      setParticipants(arenaData.participants);
    })();
  }, [arenaId]);

  // 소켓 연결 실패 처리 (최대 인원 초과 등)
  useEffect(() => {
    const handleJoinFailed = ({ reason }: { reason: string }) => {
      alert(reason);
      navigate('/arena'); // 또는 다른 페이지로 리디렉션
    };

    socket.on('arena:join-failed', handleJoinFailed);

    return () => {
      socket.off('arena:join-failed', handleJoinFailed);
    };
  }, [navigate]);

  useEffect(() => {
    const handleStarted = ({ arenaId }: { arenaId: string }) => {
      console.log('[소켓 수신] arena:start → 이동');
      navigate(`/arena/play/${arenaId}`);
    };

    socket.on('arena:start', handleStarted);

    return () => {
      socket.off('arena:start', handleStarted);
    };
  }, [navigate]);


  // 2) 소켓 이벤트 구독: 업데이트 / 삭제
  useEffect(() => {
    if (!arenaId || !currentUserId) return;

    // 서버에서 broadcastUpdate 로 보낸 객체 구조:
    // { participants: Participant[], host: string, status: 'waiting'|'started'|'ended' }
    const handleUpdate = ({
      participants: list,
      host,
      status: newStatus,
    }: {
      participants: Participant[];
      host: string;
      status: 'waiting' | 'started' | 'ended';
    }) => {
      // 떠난 사람 필터링(hasLeft 플래그)
      console.log('[소켓] arena:update', list);
      setParticipants(list.filter(p => !p.hasLeft));
      setHostId(host);
      setIsHost(currentUserId === host);
      setStatus(newStatus);
    };

    const handleDeleted = ({ arenaId: deleted }: { arenaId: string }) => {
      if (deleted === arenaId) {
        navigate('/arena');
      }
    };

    socket.on('arena:update', handleUpdate);
    socket.on('arena:deleted', handleDeleted);

    return () => {
      // 언마운트 시 leave emit → 서버가 곧 update나 deleted를 보내줌
      socket.emit('arena:leave', { arenaId, userId: currentUserId });
      socket.off('arena:update', handleUpdate);
      socket.off('arena:deleted', handleDeleted);
    };
  }, [arenaId, currentUserId, navigate]);

  // 내 준비 상태 찾기
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
        return uid !== hostId; // 호스트 제외 ← 이 조건이 문제일 수 있음
      })
      .every(p => p.isReady && !p.hasLeft);

  return (
    <Main>
      <div className="arena-frame">
        <h2 className="arena-title">{arenaName}</h2>
        <div className="participants-list">
          {participants.map((p, index) => {
            const uid = typeof p.user === 'string' ? p.user : p.user._id;
            const name = typeof p.user === 'string' ? p.user : p.user.username;
            const readyFlag = p.isReady;
            const isHostUser = uid === hostId;

            return (
              <>
              <div
                key={uid}
                className={`participant-card ${readyFlag ? 'ready' : ''}`}
              >
                <span className="participant-name">{name}</span>
                {isHostUser ? (
                  <span className="host-label">👑 Host</span>
                ) : (
                  <span className={`participant-status ${readyFlag ? 'ready' : 'not-ready'}`}>
                    {readyFlag ? '✅ Ready' : '❌ Not Ready'}
                  </span>
                )}
              </div>
              </>
              );
            })}
              
          </div>

        <div className="action-buttons">
          {isHost ? (
            <button
              className="btn start-btn"
              disabled={!allReady} // 🔒 준비 안된 사람 있으면 비활성화
              onClick={() => {
                if (!currentUserId) {
                  console.warn('❗ currentUserId is null. emit 취소됨');
                  return;
                }
                console.log('프론트 emit:', arenaId, currentUserId);
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
