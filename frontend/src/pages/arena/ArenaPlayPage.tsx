// src/pages/arena/ArenaPlayPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import socket from '../../utils/socket';
import Main from '../../components/main/Main';
import DownloadVPNProfile from '../../components/play/DownloadVPNProfile';
import { getArenaById } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaPlayPage.scss';;

type Participant = {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
  instanceId?: string | null;
  vpnIp?: string | null;
};

type ArenaUpdatePayload = {
  arenaId: string;
  status: 'waiting' | 'started' | 'ended';
  host: string;
  startTime?: string | null;
  endTime?: string | null;
  participants: Participant[];
};

const ArenaPlayPage: React.FC = () => {
  const { id: arenaId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [arenaName, setArenaName] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState<'waiting' | 'started' | 'ended'>('waiting');
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [remaining, setRemaining] = useState<number>(0); // ms

  // 새로 추가: 내 vm/ip/머신
  const [myInstanceId, setMyInstanceId] = useState<string | null>(null);
  const [myVpnIp, setMyVpnIp] = useState<string | null>(null);
  const [machineId, setMachineId] = useState<string | null>(null);

  const [flag, setFlag] = useState('');
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const joinedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // 1) 유저/아레나 초기 로드 + 방 진입
  useEffect(() => {
    if (!arenaId) return;

    (async () => {
      const { user } = await getUserStatus();
      setCurrentUserId(user._id);

      const arenaData = await getArenaById(arenaId);
      setArenaName(arenaData.name);
      setHostId(String(arenaData.host));
      setStatus(arenaData.status);
      if (arenaData.startTime) setStartAt(new Date(arenaData.startTime));
      if (arenaData.endTime) setEndAt(new Date(arenaData.endTime));
      setParticipants(arenaData.participants || []);

      // machineId(문자/객체 모두 대응)
      setMachineId(String((arenaData as any).machine?._id ?? (arenaData as any).machine ?? '') || null);

      // 플레이 페이지는 "시작된 방"만 허용
      if (arenaData.status !== 'started') {
        navigate(`/arena/${arenaId}`); // 로비로
        return;
      }

      // 소켓 join(중복 방지)
      if (!joinedRef.current) {
        joinedRef.current = true;
        const doJoin = () => socket.emit('arena:join', { arenaId, userId: user._id });
        if (socket.connected) doJoin();
        else socket.once('connect', doJoin);
      }

      // 내 인스턴스/아이피 초기 세팅
      const me = (arenaData.participants || []).find((p: any) =>
        (typeof p.user === 'string' ? p.user : p.user._id) === user._id
      ) as Participant | undefined;
      if (me) {
        setMyInstanceId(me.instanceId ?? null);
        setMyVpnIp(me.vpnIp ?? null);
      }
    })();
  }, [arenaId, navigate]);

  // 2) 타이머 관리
  useEffect(() => {
    if (!endAt) return;
    if (timerRef.current) window.clearInterval(timerRef.current);

    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, endAt.getTime() - now);
      setRemaining(left);
      if (left === 0 && timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    tick();
    timerRef.current = window.setInterval(tick, 1000) as unknown as number;

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [endAt]);

  // 3) 소켓 이벤트 바인딩
  useEffect(() => {
    const handleUpdate = (payload: ArenaUpdatePayload) => {
      setStatus(payload.status);
      setHostId(payload.host);
      setParticipants(payload.participants || []);
      if (payload.startTime) setStartAt(new Date(payload.startTime));
      if (payload.endTime) setEndAt(new Date(payload.endTime));

      // 내 인스턴스/아이피 갱신
      if (currentUserId) {
        const me = payload.participants.find(p =>
          (typeof p.user === 'string' ? p.user : p.user._id) === currentUserId
        );
        if (me) {
          setMyInstanceId(me.instanceId ?? null);
          setMyVpnIp(me.vpnIp ?? null);
        }
      }

      // 플레이 중에 ended 되면 결과/로비로 이동(원하는 UX로 바꿔도 됨)
      if (payload.status === 'ended') {
        navigate(`/arena/${payload.arenaId}`);
      }
    };

    const handleDeleted = ({ arenaId: deleted }: { arenaId: string }) => {
      if (deleted === arenaId) navigate('/arena');
    };

    const handleJoinFailed = ({ reason }: { reason: string }) => {
      alert(reason);
      navigate('/arena');
    };

    socket.on('arena:update', handleUpdate);
    socket.on('arena:deleted', handleDeleted);
    socket.on('arena:join-failed', handleJoinFailed);

    return () => {
      // 떠날 때 나가기
      if (currentUserId && arenaId) {
        socket.emit('arena:leave', { arenaId, userId: currentUserId });
      }
      socket.off('arena:update', handleUpdate);
      socket.off('arena:deleted', handleDeleted);
      socket.off('arena:join-failed', handleJoinFailed);
    };
  }, [arenaId, currentUserId, navigate]);

  // 표시용 포맷
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  // 4) 플래그 제출
  const submitFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineId) {
      setSubmitMsg('machineId를 불러오지 못했습니다.');
      return;
    }
    try {
      setSubmitting(true);
      setSubmitMsg(null);
      const res = await axios.post(`/api/arena/${arenaId}/submit`, {
        flag,
        machineId,
      });
      setSubmitMsg(res.data?.msg || '정답입니다!');
    } catch (err: any) {
      setSubmitMsg(err?.response?.data?.msg || '제출 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Main>
      {/* 상단바 */}
      <header className="play-header">
        <h2 className="title">{arenaName}</h2>
        <div className="spacer" />
        <div className="timer-pill">⏱ {mm}:{String(ss).padStart(2,'0')}</div>
        <DownloadVPNProfile />
      </header>

      {/* 2열 레이아웃 */}
      <div className="play-grid">
        {/* 좌측: 내 VM */}
        <section className="card vm-card">
          <h3>내 VM</h3>
          <div className="kv">
            <span className="k">Instance ID</span>
            <span className="v"><code>{myInstanceId || '생성 중...'}</code></span>
          </div>
          <div className="kv">
            <span className="k">VPN IP</span>
            <span className="v"><code>{myVpnIp || '할당 대기...'}</code></span>
          </div>
          <p className="hint">
            {myVpnIp ? <>OVPN 연결 후 <code>{myVpnIp}</code> 접속</> : '인스턴스가 뜨는 중입니다. 잠시만 기다려 주세요.'}
          </p>

          {/* 플래그 제출 */}
          <form onSubmit={submitFlag} className="flag-form">
            <input
              type="text"
              placeholder="FLAG{...}"
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
              required
            />
            <button type="submit" disabled={submitting || !flag}>
              {submitting ? '제출 중...' : '제출'}
            </button>
          </form>
          {submitMsg && <div className="flag-msg">{submitMsg}</div>}
        </section>

        {/* 우측: 참가자 */}
        <aside className="card participants-card">
          <h4>참가자</h4>
          <ul className="participants">
            {participants.map(p => {
              const uid  = typeof p.user === 'string' ? p.user : p.user._id;
              const name = typeof p.user === 'string' ? p.user : p.user.username;
              const isHostUser = uid === hostId;
              return (
                <li key={uid} className={`row ${p.hasLeft ? 'left' : ''}`}>
                  <span className="name">{name}</span>
                  {isHostUser && <span className="badge">👑 Host</span>}
                  {p.hasLeft && <span className="badge muted">나감</span>}
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </Main>
  );
};

export default ArenaPlayPage;
