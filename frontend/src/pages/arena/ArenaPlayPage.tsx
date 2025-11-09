// src/pages/arena/ArenaPlayPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../../utils/socket';
import Main from '../../components/main/Main';
import { getArenaById } from '../../api/axiosArena';
import { getUserStatus } from '../../api/axiosUser';
import '../../assets/scss/arena/ArenaPlayPage.scss';

import TerminalRace from '../../components/arena/TerminalRace';
// import HackersDeck from '../../components/arena/HackersDeck';
// import DefenseBattleUI from '../../components/play/DefenseBattleUI';
// import CaptureServerUI from '../../components/play/CaptureServerUI';
// import ExploitChainUI from '../../components/play/ExploitChainUI';
import ActivityFeed from '../../components/arena/ActivityFeed';

type Participant = {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
  progress?: any; // (선택) 모드별 진행도(예: 점수, 스테이지)
};

type ArenaUpdatePayload = {
  arenaId: string;
  status: 'waiting' | 'started' | 'ended';
  host: string;
  startTime?: string | null;
  endTime?: string | null;
  participants: Participant[];
  mode: string; 
};

const ArenaPlayPage: React.FC = () => {
  const { id: arenaId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // --- 공통 상태 (유지) ---
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [arenaName, setArenaName] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState<'waiting' | 'started' | 'ended'>('waiting');
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [remaining, setRemaining] = useState<number>(0); // ms

  const [mode, setMode] = useState<string | null>(null);

  // --- VPN/Flag 관련 상태 (제거) ---
  // const [problemInstanceId, setProblemInstanceId] = useState<string | null>(null);
  // const [problemInstanceIp, setProblemInstanceIp] = useState<string | null>(null);
  // const [myVpnIp, setMyVpnIp] = useState<string | null>(null);
  // const [machineId, setMachineId] = useState<string | null>(null);
  // const [needVpnConnection, setNeedVpnConnection] = useState(false);
  // const [flag, setFlag] = useState('');
  // const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  // const [submitting, setSubmitting] = useState(false);

  const joinedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const getParticipantStatus = (p: Participant) => {
    if (p.hasLeft) return { text: 'Left', className: 'status-left' };
    
    // 대기중일 때
    if (status === 'waiting') {
      return p.isReady 
        ? { text: 'Ready', className: 'status-ready' } 
        : { text: 'Waiting', className: 'status-waiting' };
    }
    // 시작 후 (향후 progress.score 등으로 확장 가능)
    if (status === 'started') {
      return { text: 'Playing', className: 'status-playing' };
    }
    return { text: '', className: '' };
  };

  // 1) 유저/아레나 초기 로드 + 방 진입 (수정)
  useEffect(() => {
    if (!arenaId) return;

    (async () => {
      const { user } = await getUserStatus();
      setCurrentUserId(user._id);

      const arenaData = await getArenaById(arenaId);
      setArenaName(arenaData.name);
      setHostId(String(arenaData.host));
      setStatus(arenaData.status);
      setMode(arenaData.mode); 
      if (arenaData.startTime) setStartAt(new Date(arenaData.startTime));
      if (arenaData.endTime) setEndAt(new Date(arenaData.endTime));
      setParticipants(arenaData.participants || []);

      // 소켓 join(중복 방지)
      if (!joinedRef.current) {
        joinedRef.current = true;
        const doJoin = () => socket.emit('arena:join', { arenaId, userId: user._id });
        if (socket.connected) doJoin();
        else socket.once('connect', doJoin);
      }
    })();
  }, [arenaId, navigate]);

  // 2) 타이머 관리 (유지)
  useEffect(() => {
    // ... (기존 코드와 동일) ...
  }, [endAt]);

  // 2-1) 타임업 안전망 (유지)
  useEffect(() => {
    if (status === 'ended') {
      navigate(`/arena/result/${arenaId}`);
    }
  }, [status, arenaId, navigate]);

  // 3) 소켓 이벤트 바인딩 (수정)
  useEffect(() => {
    const handleUpdate = (payload: ArenaUpdatePayload) => {
      setStatus(payload.status);
      setHostId(payload.host);
      setParticipants(payload.participants || []);
      if (payload.startTime) setStartAt(new Date(payload.startTime));
      if (payload.endTime) setEndAt(new Date(payload.endTime));
      
      // ----------------------------------------------------
      // ‼️ 여기가 수정된 부분입니다 ‼️
      // payload에 mode 값이 있을 때만 업데이트하여
      // 'undefined'로 덮어쓰는 것을 방지합니다.
      if (payload.mode) {
        setMode(payload.mode);
      }
      // ----------------------------------------------------

      // 서버가 ended 푸시 시 이동
      if (payload.status === 'ended') {
        navigate(`/arena/result/${payload.arenaId}`);
      }
    };

    const handleStart = (data: { arenaId: string; startTime: string; endTime: string; }) => {
      // (VPN 관련 알림 제거)
      console.log('Arena started!', data);
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

  // 3-1) arena:ended 이벤트 (유지)
  useEffect(() => {
    // ‼️ "종료" 이벤트를 수신하는 핸들러 ‼️
    const handleEnded = (data?: { arenaId?: string }) => {
      // (결과 페이지로 즉시 이동)
      navigate(`/arena/result/${data?.arenaId ?? arenaId}`);
    };

    // ‼️ 소켓 리스너 등록 ‼️
    socket.on('arena:ended', handleEnded);

    // ‼️ 컴포넌트 언마운트 시 리스너 제거 ‼️
    return () => {
      socket.off('arena:ended', handleEnded);
    };
  }, [arenaId, navigate]);


  // 표시용 포맷 (유지)
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  const renderGameContent = () => {
    if (!mode) {
      return (
        <div className="ap-panel">
          <div className="ap-panel-body">Loading game mode...</div>
        </div>
      );
    }
    const currentArenaProps = {
      _id: arenaId!,
      name: arenaName,
      mode: mode!,
      status: status,
      host: hostId!,
      startTime: startAt?.toISOString() || null,
      endTime: endAt?.toISOString() || null,
      participants: participants
    };

    // arena 객체와 socket 인스턴스를 props로 넘겨줍니다.
    switch (mode) {
      case 'Terminal Race':
        return <TerminalRace arena={currentArenaProps} socket={socket} currentUserId={currentUserId} participants={participants} />;
      case "Hacker's Deck":
        return <div>Hacker's Deck (To be implemented)</div>
      case 'Defense Battle':
        // return <DefenseBattleUI arena={arena!} socket={socket} />;
        return <div>Defense Battle (To be implemented)</div>
      case 'Capture Server':
        // return <CaptureServerUI arena={arena!} socket={socket} />;
        return <div>Capture Server (To be implemented)</div>
      case 'Exploit Chain':
        // return <ExploitChainUI arena={arena!} socket={socket} />;
        return <div>Exploit Chain (To be implemented)</div>
      default:
        return (
          <div className="ap-panel">
            <div className="ap-panel-header"><h3>Error</h3></div>
            <div className="ap-panel-body">
              <p>Unknown or unimplemented game mode: {mode}</p>
            </div>
          </div>
        );
    }
  };


  return (
    <Main>
      <div className="ap-container">
        {/* ... (배경/코너 장식은 기존과 동일) ... */}

        {/* 상단 헤더 (유지) */}
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

          {/* ‼️ 왼쪽 사이드바 (수정) ‼️ */}
          {/* (VPN/IP 정보 대신 '게임 정보' 표시) */}
          <aside className="ap-sidebar">
            <div className="ap-panel">
              <div className="ap-panel-header">
                <h3>GAME INFO</h3>
              </div>
              <div className="ap-panel-body">
                <div className="ap-info-item">
                  <label>Mode</label>
                  <p className="ap-data-text">{mode || '---'}</p>
                </div>
                <div className="ap-info-item">
                  <label>Start Time</label>
                  <p className="ap-data-text">
                    {startAt ? startAt.toLocaleString() : 'Waiting...'}
                  </p>
                </div>
                <div className="ap-info-item">
                  <label>Target</label>
                  <p className="ap-data-text">{
                    mode === 'Terminal Race' ? 'Virtual Server' :
                    mode === "Hacker's Deck" ? 'Opponent' : '---'
                  }</p>
                </div>
              </div>
              {mode === 'Terminal Race' && (
                <ActivityFeed 
                  socket={socket} 
                  currentUserId={currentUserId} 
                  participants={participants} 
                />
              )}
            </div>
          </aside>

          {/* ‼️ 중앙 메인 영역 (수정) ‼️ */}
          {/* (플래그 폼 대신 '알맹이' 렌더링) */}
          <main className="ap-main">
            {renderGameContent()}
          </main>

          {/* ‼️ 오른쪽 사이드바 (수정) ‼️ */}
          {/* (참가자 상태 표시 로직 변경) */}
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
                    const { text, className } = getParticipantStatus(p); // ‼️ 수정된 헬퍼 사용 ‼️

                    return (
                      <li key={uid} className="ap-participant-item">
                        <div className="ap-participant-info">
                          <span className="name">
                            {name}
                            {isHost && <span className="host-tag">H</span>}
                          </span>
                          {/* ‼️ IP 표시 제거 ‼️ */}
                        </div>
                        <span className={`ap-participant-status ${className}`}>
                          {text}
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