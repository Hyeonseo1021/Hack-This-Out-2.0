// ContestPlayPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, NavigateFunction } from 'react-router-dom';
import { getContestDetails, getContestParticipationDetails, getContestResult } from '../../api/axiosContest';
import { getInstanceByMachine } from '../../api/axiosInstance';
import GetHints from '../../components/play/GetHints';
import StartInstanceButton from '../../components/play/StartInstanceButton';
import DownloadVPNProfile from '../../components/play/DownloadVPNProfile';
import InstanceInfo from '../../components/play/InstanceInfo';
import SubmitFlagForm from '../../components/play/SubmitFlagForm';
import Timer from '../../components/play/Timer';
import GiveUpButton from '../../components/play/GiveUpButton';
import StatusIcon from '../../components/play/StatusIcon';
import Main from '../../components/main/Main';
import { ContestDetail, Machine } from '../../types/Contest';
import '../../assets/scss/contest/ContestPlayPage.scss';
import LoadingIcon from '../../components/public/LoadingIcon';
import ErrorIcon from '../../components/public/ErrorIcon';
import { PlayProvider, usePlayContext } from '../../contexts/PlayContext';
import { BsListCheck } from "react-icons/bs";
import ContestCompleteModal from '../../components/modal/ContestCompleteMD';

interface GetContestDetailsResponse {
  contest: ContestDetail;
}

interface GetContestParticipationDetailsResponse {
  participation: ContestParticipation;
  machinesLeft: number;
}

interface ContestParticipation {
  machineCompleted: { machine: string; completed: boolean }[];
  expEarned: number;
}

interface GetContestResultResponse {
  expEarned: number;
  machinesLeft: number;
}

const ContestPlayPage: React.FC = () => {
  const { contestId } = useParams<{ contestId: string }>();
  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [instanceStarted, setInstanceStarted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { instanceStatus, setInstanceStatus, downloadStatus, submitStatus, setSubmitStatus } = usePlayContext();
  const navigate: NavigateFunction = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [completedMachines, setCompletedMachines] = useState<string[]>([]);
  const [totalExpEarned, setTotalExpEarned] = useState<number>(0);
  const [machinesLeft, setMachinesLeft] = useState<number>(-1);

  useEffect(() => {
    const fetchData = async () => {
      if (!contestId) { setError('Contest ID is missing.'); setIsLoading(false); return; }
      try {
        const contestResponse: GetContestDetailsResponse = await getContestDetails(contestId);
        setContest(contestResponse.contest);

        const participationResponse: GetContestParticipationDetailsResponse = await getContestParticipationDetails(contestId);
        const participation = participationResponse.participation;
        if (participation && participation.machineCompleted.length > 0) {
          const completed = participation.machineCompleted.filter(mc => mc.completed).map(mc => mc.machine);
          setCompletedMachines(completed);
        }
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error fetching contest details:', err);
        setError(err.message || 'Failed to fetch contest details.');
        setIsLoading(false);
      }
    };
    fetchData();
  }, [contestId]);

  const handleMachineSelect = async (machine: Machine) => {
    setSelectedMachine(machine);
    setInstanceStarted(false);
    setInstanceStatus(null);
    try {
      const instanceResponse = await getInstanceByMachine(machine._id);
      if (instanceResponse.instances && instanceResponse.instances.length > 0) {
        setInstanceStarted(true);
        const currentInstance = instanceResponse.instances[0];
        setInstanceStatus(currentInstance.status);
      } else { setInstanceStarted(false); setInstanceStatus(null); }
    } catch (err: any) {
      console.error('Error fetching instance:', err);
      setError('Failed to fetch instance details.');
    }
  };
<div className="connect-box">
  <p>Connect using OpenVPN</p>
  <p>Download your VPN configuration</p>
</div>

  const handleInstanceStarted = () => { setInstanceStarted(true); };
  const handleFlagSuccess = async () => {
    if (selectedMachine) {
      setCompletedMachines(prev => [...prev, selectedMachine._id]);
      setSubmitStatus('flag-success');
      try {
        const resultResponse: GetContestResultResponse = await getContestResult(contestId || '');
        setTotalExpEarned(resultResponse.expEarned);
        setMachinesLeft(resultResponse.machinesLeft);
      } catch (err: any) { console.error('Error fetching contest result:', err); }
    }
    setSelectedMachine(null);
  };

  if (error) return <Main><div className="contest-play-container"><div className="error-message"><ErrorIcon /></div></div></Main>;
  if (!contest || isLoading) return <Main><div className="contest-play-container"><LoadingIcon /></div></Main>;

  const isRunning = instanceStatus === 'running';

  return (
    <Main>
      <div className="contest-play-container">
        <div className="contest-play-name">
          <span>{contest.name}</span>
          <Timer endTime={new Date(contest.endTime)} />
        </div>
        <div className='contest-upper-content'>
          <div className="select-machines">
            <div className='select-text'>
              <BsListCheck size={40} color="white" />
              <h2>Select a Machine</h2>
            </div>
            <select className="select-machine-dropdown" value={selectedMachine?._id || ''} onChange={e => {
              const machine = contest.machines.find(m => m._id === e.target.value);
              if (machine) handleMachineSelect(machine);
            }}>
              <option value="" disabled>Select a Machine</option>
              {contest.machines.map(machine => (
                <option key={machine._id} value={machine._id} disabled={completedMachines.includes(machine._id)}>
                  {machine.name} {completedMachines.includes(machine._id) && '(Completed)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedMachine && (
          <div className={`selected-machine-container ${submitStatus==='flag-success'? 'flag-success':''}`} ref={containerRef}>
            <div className="contest-play-name">Now Playing: {selectedMachine.name}</div>
            <GiveUpButton contestId={contestId} contestName={contest.name} machineId={selectedMachine._id} machineName={selectedMachine.name} mode="contest"/>
            <div className="download-box">
              {instanceStatus==='running'||instanceStatus==='pending'?<StatusIcon status={'completed'}/>:<StatusIcon status={downloadStatus||'idle'}/>}
              <DownloadVPNProfile />
            </div>
            <div className='btn-box'>
              <StatusIcon status={instanceStatus||'idle'}/>
              <div className='instance-hint-box'>
                {!instanceStarted ? <StartInstanceButton machineId={selectedMachine._id} onInstanceStarted={handleInstanceStarted}/> :
                  <InstanceInfo machineId={selectedMachine._id}/> }
                <GetHints machineId={selectedMachine._id} playType="contest" contestId={contestId} disabled={!isRunning}/>
              </div>
            </div>
            <div className='submit-box'>
              <StatusIcon status={submitStatus||'idle'}/>
              <SubmitFlagForm contestId={contestId} machineId={selectedMachine._id} playType="contest" onFlagSuccess={handleFlagSuccess}/>
            </div>
          </div>
        )}

        {machinesLeft===0 && <ContestCompleteModal onClose={()=>navigate(`/contest`)} expEarned={totalExpEarned}/>}
      </div>
    </Main>
  );
};

const ContestPlayPageWithProvider: React.FC = () => (
  <PlayProvider>
    <ContestPlayPage />
  </PlayProvider>
);

export default ContestPlayPageWithProvider;
