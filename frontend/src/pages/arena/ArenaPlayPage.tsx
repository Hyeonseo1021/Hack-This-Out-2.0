// src/pages/arena/ArenaPlayPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import Main from '../../components/main/Main';
import DownloadVPNProfile from '../../components/play/DownloadVPNProfile';
import { getArenaById, submitFlagArena, sendArenaVpnIp } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaPlayPage.scss';

type Participant = {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
  vpnIp?: string | null;
  status?: 'waiting' | 'vpn_connecting' | 'vm_connected' | 'flag_submitted' | 'completed';
};

type ArenaUpdatePayload = {
  arenaId: string;
  status: 'waiting' | 'started' | 'ended';
  host: string;
  startTime?: string | null;
  endTime?: string | null;
  participants: Participant[];
  problemInstanceId?: string | null;  // 추가
  problemInstanceIp?: string | null;  // 추가
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

  // 변경된 부분: 개별 인스턴스 대신 공통 문제 인스턴스
  const [problemInstanceId, setProblemInstanceId] = useState<string | null>(null);
  const [problemInstanceIp, setProblemInstanceIp] = useState<string | null>(null);
  const [myVpnIp, setMyVpnIp] = useState<string | null>(null);
  const [machineId, setMachineId] = useState<string | null>(null);
  const [needVpnConnection, setNeedVpnConnection] = useState(false);

  const [flag, setFlag] = useState('');
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const joinedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const statusText = (p: Participant) => {
    if (p.hasLeft) return 'left';
    switch (p.status) {
      case 'waiting':        return 'waiting';
      case 'vpn_connecting': return 'vpn connecting';
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

      // 문제 인스턴스 정보 설정
      setProblemInstanceId(arenaData.problemInstanceId || null);
      setProblemInstanceIp(arenaData.problemInstanceIp || null);

      // machineId(문자/객체 모두 대응)
      setMachineId(String((arenaData as any).machine?._id ?? (arenaData as any).machine ?? '') || null);

      // 소켓 join(중복 방지)
      if (!joinedRef.current) {
        joinedRef.current = true;
        const doJoin = () => socket.emit('arena:join', { arenaId, userId: user._id });
        if (socket.connected) doJoin();
        else socket.once('connect', doJoin);
      }

      // 내 VPN IP 초기 설정
      const me = (arenaData.participants || []).find((p: any) =>
        (typeof p.user === 'string' ? p.user : p.user._id) === user._id
      ) as Participant | undefined;
      if (me) {
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

      // 문제 인스턴스 정보 업데이트
      setProblemInstanceId(payload.problemInstanceId || null);
      setProblemInstanceIp(payload.problemInstanceIp || null);

      // 내 VPN IP 갱신
      if (currentUserId) {
        const me = payload.participants.find(p =>
          (typeof p.user === 'string' ? p.user : p.user._id) === currentUserId
        );
        if (me) {
          setMyVpnIp(me.vpnIp ?? null);
        }
      }

      // 서버가 ended 푸시 시 이동
      if (payload.status === 'ended') {
        navigate(`/arena/${payload.arenaId}`);
      }
    };

    const handleStart = (data: { arenaId: string; startTime: string; endTime: string; needVpnConnection?: boolean }) => {
      setNeedVpnConnection(data.needVpnConnection || false);
      // VPN 연결 필요 알림
      if (data.needVpnConnection) {
        alert('게임이 시작되었습니다! VPN 연결 후 IP를 입력해주세요.');
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
    socket.on('arena:start', handleStart);
    socket.on('arena:deleted', handleDeleted);
    socket.on('arena:join-failed', handleJoinFailed);

    return () => {
      // 떠날 때 나가기
      if (currentUserId && arenaId) {
        socket.emit('arena:leave', { arenaId, userId: currentUserId });
      }
      socket.off('arena:update', handleUpdate);
      socket.off('arena:start', handleStart);
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
      socket.off('arena:ended', handleEnded);
    };
  }, [arenaId, navigate]);

  // VPN IP 입력 및 전송 함수
  const [vpnIpInput, setVpnIpInput] = useState('');
  const [sendingVpnIp, setSendingVpnIp] = useState(false);

  const sendVpnIp = async () => {
    if (!vpnIpInput.trim()) {
      alert('VPN IP를 입력해주세요.');
      return;
    }

    try {
      setSendingVpnIp(true);
      const res = await sendArenaVpnIp(arenaId!, vpnIpInput.trim());
      alert('VPN IP가 등록되었습니다!');
      setVpnIpInput('');
      setNeedVpnConnection(false);
    } catch (error: any) {
      alert(error?.msg || 'VPN IP 등록 실패');
    } finally {
      setSendingVpnIp(false);
    }
  };

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
      const res = await submitFlagArena(arenaId!, flag, machineId);
      setSubmitMsg(res?.msg || '정답입니다!');
    } catch (err: any) {
      setSubmitMsg(err?.msg || '제출 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Main>
      <div className="ap-container">
        <div className="ap-grid-background"></div>
        <div className="ap-hud-corners">
          <div className="ap-corner top-left"></div>
          <div className="ap-corner top-right"></div>
          <div className="ap-corner bottom-left"></div>
          <div className="ap-corner bottom-right"></div>
        </div>

        {/* 상단 헤더 */}
        <header className="ap-header">
          <div className="ap-title-group">
            <h1>{arenaName}</h1>
            <span className={`ap-status-tag status-${status}`}>{status}</span>
          </div>
          <div className="ap-timer">
            <span className="ap-timer-value">{mm}:{String(ss).padStart(2, '0')}</span>
            <span className="ap-timer-label">TIME REMAINING</span>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <div className="ap-content">

          {/* 왼쪽 사이드바 */}
          <aside className="ap-sidebar">
            <div className="ap-panel">
              <div className="ap-panel-header">
                <h3>CONNECTION</h3>
              </div>
              <div className="ap-panel-body">
                <div className="ap-info-item">
                  <label>VPN Profile</label>
                  <DownloadVPNProfile />
                </div>
                <div className="ap-info-item">
                  <label>Target IP</label>
                  <p className="ap-data-text">{problemInstanceIp || '---.---.---.---'}</p>
                </div>
                <div className="ap-info-item">
                  <label>My VPN IP</label>
                  <p className={`ap-data-text ${myVpnIp ? 'connected' : 'disconnected'}`}>
                    {myVpnIp || 'Disconnected'}
                  </p>
                </div>
                {needVpnConnection && !myVpnIp && (
                  <div className="ap-info-item vpn-form">
                    <label>Enter VPN IP</label>
                    <div className="ap-input-group">
                      <input
                        type="text"
                        placeholder="Your IP Address"
                        value={vpnIpInput}
                        onChange={(e) => setVpnIpInput(e.target.value)}
                        disabled={sendingVpnIp}
                      />
                      <button
                        className="ap-button small"
                        onClick={sendVpnIp}
                        disabled={sendingVpnIp || !vpnIpInput.trim()}
                      >
                        {sendingVpnIp ? '...' : 'EXEC'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* 중앙 메인 영역 */}
          <main className="ap-main">
            <div className="ap-panel">
              <div className="ap-panel-header">
                <h3>FLAG SUBMISSION</h3>
              </div>
              <div className="ap-panel-body">
                <form onSubmit={submitFlag} className="ap-flag-form">
                  <input
                    type="text"
                    className="ap-flag-input"
                    placeholder="FLAG{...}"
                    value={flag}
                    onChange={(e) => setFlag(e.target.value)}
                    disabled={isTimeUp || !myVpnIp}
                  />
                  <button
                    type="submit"
                    className="ap-button primary"
                    disabled={isTimeUp || submitting || !flag || !myVpnIp}
                  >
                    {submitting ? 'PROCESSING...' : 'SUBMIT'}
                  </button>
                </form>
                <div className="ap-message-box">
                  {submitMsg && <p className="ap-message msg-success">[+] {submitMsg}</p>}
                  {isTimeUp && <p className="ap-message msg-error">[!] Mission Failed: Time Expired</p>}
                  {!myVpnIp && status === 'started' && (
                    <p className="ap-message msg-warning">[*] Notice: VPN Connection Required</p>
                  )}
                </div>
              </div>
            </div>
          </main>

          {/* 오른쪽 사이드바 */}
          <aside className="ap-sidebar">
            <div className="ap-panel">
              <div className="ap-panel-header">
                <h3>OPERATORS ({participants.filter(p => !p.hasLeft).length})</h3>
              </div>
              <div className="ap-panel-body">
                <ul className="ap-participant-list">
                  {participants.map(p => {
                    const uid = typeof p.user === 'string' ? p.user : p.user._id;
                    const name = typeof p.user === 'string' ? '...' : p.user.username;
                    const isHost = uid === hostId;
                    const status = statusText(p);
                    const displayIp = uid === currentUserId ? p.vpnIp : '***.***.***.***';

                    return (
                      <li key={uid} className="ap-participant-item">
                        <div className="ap-participant-info">
                          <span className="name">
                            {name}
                            {isHost && <span className="host-tag">H</span>}
                          </span>
                          <span className="ip">{displayIp || 'offline'}</span>
                        </div>
                        <span className={`ap-participant-status status-${status.replace(/ /g, '-')}`}>
                          {status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Main>
  );
}

export default ArenaPlayPage;