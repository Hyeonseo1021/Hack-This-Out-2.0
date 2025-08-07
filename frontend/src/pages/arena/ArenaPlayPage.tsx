import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Main from '../../components/main/Main';
import DownloadVPNProfile from '../../components/play/DownloadVPNProfile';
import InstanceInfo from '../../components/play/InstanceInfo';
import SubmitFlagForm from '../../components/play/SubmitFlagForm';
import StatusIcon from '../../components/play/StatusIcon';
import LoadingIcon from '../../components/public/LoadingIcon';
import ErrorIcon from '../../components/public/ErrorIcon';
import '../../assets/scss/arena/ArenaPlayPage.scss'; // 재활용
import { usePlayContext } from '../../contexts/PlayContext';
import socket from '../../utils/socket';
import { getUserStatus } from '../../api/axiosUser';
import { getArenaById } from '../../api/axiosArena'; // 추가: 아레나 정보 초기 로드

const ArenaPlayPage: React.FC = () => {
  const { arenaId } = useParams<{ arenaId: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [machineId, setMachineId] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [instanceInfo, setInstanceInfo] = useState<{ instanceId: string; publicIp: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    instanceStatus,
    setInstanceStatus,
    submitStatus,
    setSubmitStatus,
  } = usePlayContext();

  const handleFlagSuccess = () => {
    setSubmitStatus('flag-success');
  };


  // 1) 초기화 및 인스턴스 요청: 유저 상태를 가져오고, 인스턴스 생성 요청
  useEffect(() => {
    if (!arenaId) return;

    // 서버로부터 인스턴스 정보 수신
    const handleInstanceReady = ({ publicIp, instanceId }: { publicIp: string; instanceId: string }) => {
      console.log('[클라이언트] 인스턴스 생성 완료:', publicIp);
      setInstanceInfo({ publicIp, instanceId });
      setInstanceStatus('running');
      setLoading(false);
    };

    // 서버로부터 인스턴스 생성 실패 수신
    const handleInstanceFailed = ({ reason }: { reason: string }) => {
      console.error('[클라이언트] 인스턴스 생성 실패:', reason);
      setError(reason);
      setLoading(false);
    };
    
    // 서버로부터 아레나 종료 시그널 수신
    const handleArenaEnded = () => {
      console.log('[클라이언트] 아레나 종료 이벤트 수신');
      navigate(`/arena/result/${arenaId}`);
    };
    
    // socket 이벤트 리스너 등록
    socket.on('arena:instance-ready', handleInstanceReady);
    socket.on('arena:instance-failed', handleInstanceFailed);
    socket.on('arena:ended', handleArenaEnded);

    (async () => {
      try {
        const { user } = await getUserStatus();
        setCurrentUserId(user._id);

        const arenaData = await getArenaById(arenaId);
        setEndTime(new Date(arenaData.endTime));

        // 소켓 이벤트 요청: 인스턴스 생성
        socket.emit('arena:play-ready', { arenaId, userId: user._id });

      } catch (err) {
        console.error(err);
        setError('사용자 인증 또는 아레나 정보 로드 실패');
        setLoading(false);
      }
    })();
    
    return () => {
      socket.off('arena:instance-ready', handleInstanceReady);
      socket.off('arena:instance-failed', handleInstanceFailed);
      socket.off('arena:ended', handleArenaEnded);
    };
  }, [arenaId, navigate, setInstanceStatus]);

  // 타이머 설정 및 업데이트
  useEffect(() => {
    if (!endTime) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const remaining = endTime.getTime() - now;
      if (remaining <= 0) {
        clearInterval(interval);
        setTimeLeft(0);
        return;
      }
      setTimeLeft(Math.max(0, Math.floor(remaining / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  // 타이머가 0이 되면 결과 페이지로 자동 이동
  useEffect(() => {
    if (timeLeft === 0 && endTime) {
      navigate(`/arena/result/${arenaId}`);
    }
  }, [timeLeft, endTime, navigate, arenaId]);

  // 성공 시 애니메이션
  useEffect(() => {
    if (submitStatus === 'flag-success' && containerRef.current) {
      containerRef.current.classList.add('flag-success');
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      containerRef.current?.classList.remove('flag-success');
    }
  }, [submitStatus]);

  if (error) {
    return (
      <Main>
        <div className="arena-play-container" ref={containerRef}>
          <div className="error-message"><ErrorIcon /> {error}</div>
        </div>
      </Main>
    );
  }

  if (loading || !instanceInfo) {
    return (
      <Main>
        <div className="arena-play-container" ref={containerRef}>
          <LoadingIcon />
        </div>
      </Main>
    );
  }

  return (
    <Main>
      <div className={`arena-play-container ${submitStatus === 'flag-success' ? 'flag-success' : ''}`} ref={containerRef}>
        <div className="arena-play-name">
          <h3><b>🚀 Arena Challenge</b></h3>
        </div>

        <div className="arena-timer">
          ⏳ 남은 시간: {Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}
        </div>

        <div className="download-box">
          <StatusIcon status={'completed'} />
          <DownloadVPNProfile />
        </div>

        {/* instanceInfo가 null이 아닐 때만 렌더링 */}
        {/*instanceInfo && <InstanceInfo publicIp={instanceInfo.publicIp} />}

        {/* arenaId와 currentUserId가 null이 아닐 때만 렌더링 */}
        {arenaId && currentUserId && machineId && (
          <SubmitFlagForm
            arenaId={arenaId}
            machineId={machineId}
            playType="arena"
            onFlagSuccess={handleFlagSuccess}
          />
        )}
      </div>
    </Main>
  );
};

export default ArenaPlayPage;