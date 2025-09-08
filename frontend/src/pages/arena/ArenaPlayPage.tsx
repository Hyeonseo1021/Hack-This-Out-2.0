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
  status?: 'waiting' | 'vm_connected' | 'flag_submitted' | 'completed';
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

  // 내 VM/IP/머신
  const [myInstanceId, setMyInstanceId] = useState<string | null>(null);
  const [myVpnIp, setMyVpnIp] = useState<string | null>(null);
  const [machineId, setMachineId] = useState<string | null>(null);

  const [flag, setFlag] = useState('');
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const joinedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const statusText = (p: Participant) => {
    if (p.hasLeft) return 'left';
    switch (p.status) {
      case 'waiting':        return 'waiting';
      case 'vm_connected':   return 'vm connected';
      case 'flag_submitted': return 'flag submitted';
      case 'completed':      return 'completed';
      default:               return '';
    }
  };

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

  // 2-1) 타임업 안전망: 남은시간 0이면 이동
  useEffect(() => {
    if (status === 'ended') {
      navigate(`/arena/${arenaId}`);
    }
  }, [status, arenaId, navigate]);

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

      // 서버가 ended 푸시 시 이동
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

  // 3-1) arena:ended 이벤트도 잡아서 이동(옵션이지만 안전)
  useEffect(() => {
    const handleEnded = (data?: { arenaId?: string }) => {
      navigate(`/arena/${data?.arenaId ?? arenaId}`);
    };

    socket.on('arena:ended', handleEnded);

    return () => {
      // ✅ cleanup은 아무 것도 반환하지 않도록 블록으로
      socket.off('arena:ended', handleEnded);
    };
  }, [arenaId, navigate]);



  // 표시용 포맷
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  // 타임업/종료 시 입력/버튼 비활성화
  const isTimeUp = remaining === 0 || status !== 'started';

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
    <div className="play-cockpit-container">
      <div className="background-overlay" />

      <div className="cockpit-grid">
        {/* ───────── 좌측: 시스템 & 커넥션 패널 ───────── */}
        <section className="cockpit-panel">
          <header className="panel-header">SYSTEM & CONNECTION</header>
          <div className="panel-content">
            <div className="system-info-list">
              <div className="info-block vpn-download">
                <span className="label">1. OVPN PROFILE</span>
                {/* DownloadVPNProfile 컴포넌트 버튼이 .cyber-button 스타일을 따르도록 해야 할 수 있습니다. */}
                {/* 필요하다면 DownloadVPNProfile 내부 버튼에 className="cyber-button" 같은 속성을 추가하세요. */}
                <DownloadVPNProfile />
              </div>
              <div className="info-block">
                <span className="label">2. VM INSTANCE ID</span>
                <div className="value">{myInstanceId || 'ALLOCATING...'}</div>
              </div>
              <div className="info-block">
                <span className="label">3. SECURE IP ADDRESS</span>
                <div className="value">{myVpnIp || 'AWAITING ASSIGNMENT...'}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── 중앙: 메인 코어 (타이머 & 플래그) ───────── */}
        <section className="cockpit-panel main-core-panel">
          <div className="big-timer">{mm}:{String(ss).padStart(2, '0')}</div>
          
          <div className="flag-submission-unit">
            <form onSubmit={submitFlag} className="flag-form">
              <span className="prompt">&gt;</span>
              <input
                type="text"
                placeholder="SUBMIT FLAG..."
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                required
                disabled={isTimeUp}
              />
              <button type="submit" disabled={isTimeUp || submitting || !flag}>
                {submitting ? 'SENDING' : 'EXECUTE'}
              </button>
            </form>
            {submitMsg && <div className="flag-msg">SYSTEM RESPONSE: {submitMsg}</div>}
            {isTimeUp && <div className="flag-msg">CONNECTION TIMED OUT</div>}
          </div>
        </section>

        {/* ───────── 우측: 참가자 명단 (Roster) ───────── */}
        <aside className="cockpit-panel">
          <header className="panel-header">PARTICIPANT ROSTER</header>
          <div className="panel-content">
            <div className="roster-list">
              {participants.map(p => {
                const uid  = typeof p.user === 'string' ? p.user : p.user._id;
                const name = typeof p.user === 'string' ? '...' : p.user.username; // 유저 객체가 없을 경우 대비
                const currentStatus = statusText(p).replace(' ', '_'); // e.g., 'vm_connected'

                return (
                  <div key={uid} className="roster-row">
                    <span className="username">{name}{uid === hostId && ' [HOST]'}</span>
                    <span className={`status ${currentStatus}`}>{currentStatus}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  </Main>
  );
}
export default ArenaPlayPage;
