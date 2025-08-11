// src/pages/arena/ArenaRoomPage.tsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
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

type ArenaUpdatePayload = {
  arenaId: string;
  status: 'waiting' | 'started' | 'ended' | string;
  host: string; // 서버가 문자열로 보냄
  startTime?: string | null;
  endTime?: string | null;
  participants: Participant[];
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
  const skipLeaveRef = useRef(false);

  // 내 카드 / 활성 인원 / 전체 준비 여부
  const myParticipant = useMemo(
    () => participants.find(p => (typeof p.user === 'string' ? p.user : p.user._id) === currentUserId),
    [participants, currentUserId]
  );
  const activeParticipants = useMemo(
    () => participants.filter(p => !p.hasLeft),
    [participants]
  );
  const everyoneReady = useMemo(
    () => activeParticipants.length > 0 && activeParticipants.every(p => p.isReady),
    [activeParticipants]
  );
  // 호스트 제외 활성 참가자
  const nonHostParticipants = useMemo(() => {
    return participants.filter(p => {
      const uid = typeof p.user === 'string' ? p.user : p.user._id;
      return uid !== hostId; // host 제외
    });
  }, [participants, hostId]);

  // 호스트 제외 모두 준비
  const everyoneExceptHostReady = useMemo(() => {
    return nonHostParticipants.length > 0 && nonHostParticipants.every(p => p.isReady);
  }, [nonHostParticipants]);


  // 유저/아레나 이름 로딩
  useEffect(() => {
    getUserStatus()
      .then(res => setCurrentUserId(res?.user?._id ?? res?.data?.user?._id ?? null))
      .catch(() => { /* ignore */ });

    if (arenaId) {
      getArenaById(arenaId)
        .then(res => setArenaName(res?.name ?? res?.data?.name ?? ''))
        .catch(() => { /* ignore */ });
    }
  }, [arenaId]);

  // 소켓 바인딩 + join + cleanup
  useEffect(() => {
    if (!arenaId || !currentUserId) return;

    // 중복 리스너 방지
    socket.off('arena:update');
    socket.off('arena:join-failed');
    socket.off('arena:start');
    socket.off('arena:start-failed');
    socket.off('arena:ready-failed');

    const handleUpdate = (payload: ArenaUpdatePayload) => {
      setStatus((payload.status as any) || 'waiting');
      setHostId(payload.host || null);
      setIsHost(payload.host === currentUserId);
      setParticipants(payload.participants || []);
    };

    const handleJoinFailed = ({ reason }: { reason: string }) => {
      alert(reason);
      navigate('/arena');
    };

    const handleStart = ({ arenaId: id }: { arenaId: string }) => {
      skipLeaveRef.current = true;        // ✅ 플레이로 이동 중 표시
      navigate(`/arena/play/${id}`);
    };

    const handleStartFailed = ({ reason }: { reason: string }) => {
      alert(reason);
    };

    const handleReadyFailed = ({ reason }: { reason: string }) => {
      alert(reason);
    };

    socket.on('arena:update', handleUpdate);
    socket.on('arena:join-failed', handleJoinFailed);
    socket.on('arena:start', handleStart);
    socket.on('arena:start-failed', handleStartFailed);
    socket.on('arena:ready-failed', handleReadyFailed);

    // 입장
    socket.emit('arena:join', { arenaId, userId: currentUserId });

    return () => {
      // 나가기 + 핸들러 해제
      if (!skipLeaveRef.current) {
        socket.emit('arena:leave', { arenaId, userId: currentUserId });
      }
      socket.off('arena:update', handleUpdate);
      socket.off('arena:join-failed', handleJoinFailed);
      socket.off('arena:start', handleStart);
      socket.off('arena:start-failed', handleStartFailed);
      socket.off('arena:ready-failed', handleReadyFailed);
    };
  }, [arenaId, currentUserId, navigate]);

  // 방 목록 전역 업데이트도 방 화면에서 수신해서 '나간 사람' 즉시 제거 + 동기화 요청
  useEffect(() => {
    if (!arenaId) return;

    const handleRoomUpdatedThisRoom = (updated: {
      _id: string;
      participants?: { user: string }[];
    }) => {
      if (!updated || updated._id !== arenaId) return;

      const ids = new Set((updated.participants ?? []).map(u => String(u.user)));

      // 1) 로컬에서 '없는 사람' 즉시 제거 (새로고침 없이 카드 사라짐)
      setParticipants(prev => prev.filter(p => {
        const uid = typeof p.user === 'string' ? p.user : p.user._id;
        return ids.has(uid);
      }));

      // 2) 유저명 등 디테일 동기화(짧은 스냅샷 요청) — 서버에 'arena:sync' 핸들러 필요
      socket.emit('arena:sync', { arenaId });
    };

    socket.on('arena:room-updated', handleRoomUpdatedThisRoom);
    return () => {
      socket.off('arena:room-updated', handleRoomUpdatedThisRoom);
    };
  }, [arenaId]);


  // 준비 토글
  const toggleReady = () => {
    if (!arenaId || !currentUserId) return;
    if (status !== 'waiting') return;
    const next = !(myParticipant?.isReady ?? false);
    socket.emit('arena:ready', { arenaId, userId: currentUserId, ready: next });
  };

  return (
    <Main>
      <div className="arena-frame">
        <h2 className="arena-title">{arenaName}</h2>

        <div className="participants-list">
          {participants.map((p) => {
            const uid = typeof p.user === 'string' ? p.user : p.user._id;
            const name = typeof p.user === 'string' ? p.user : p.user.username;
            const readyFlag = p.isReady;
            const isHostUser = uid === hostId;
            const isMe = uid === currentUserId;

            return (
              <div
                key={uid}
                className={`participant-card ${readyFlag ? 'ready' : ''} ${p.hasLeft ? 'left' : ''}`}
              >
                <span className="participant-name">
                  {name} {isMe ? '(me)' : ''}
                </span>
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
              disabled={
                !isHost ||
                status !== 'waiting' ||
                !everyoneExceptHostReady ||
                participants.length < 2 // 최소 2명(호스트+1)
              }
              onClick={() => {
                if (!currentUserId) return;
                socket.emit('arena:start', { arenaId, userId: currentUserId });
              }}
              title={
                !isHost ? '호스트만 시작 가능' :
                status !== 'waiting' ? '대기 상태에서만 시작' :
                !everyoneExceptHostReady ? '호스트 제외 전원이 준비해야 함' :
                participants.length < 2 ? '최소 2명 필요' : ''
              }
            >
              게임 시작
            </button>
          ) : (
            <button
              className="btn"
              disabled={!currentUserId || status !== 'waiting'}
              onClick={toggleReady}
            >
              {participants.find(p => (typeof p.user === 'string' ? p.user : p.user._id) === currentUserId)?.isReady
                ? '준비 취소'
                : '준비'}
            </button>
          )}
        </div>
      </div>
    </Main>
  );
};

export default ArenaRoomPage;
