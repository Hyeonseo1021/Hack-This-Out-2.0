import React, { useEffect, useState } from 'react';
import StatCard from '../../components/admin/StatCard';
import { FaUsers, FaServer, FaClipboardList, FaCogs, FaGamepad } from 'react-icons/fa';
import { getAllUser } from '../../api/axiosUser';
import { getAllMachines } from '../../api/axiosMachine';
import { getContests } from '../../api/axiosContest';
import { getAllInstances } from '../../api/axiosInstance';
import { getAllScenarios } from '../../api/axiosScenario'; // ✅ 추가
import ErrorMessage from '../../components/admin/ErrorMessage';
import Sidebar from '../../components/admin/AdminSidebar';

interface DashboardStats {
  users: {
    total: number;
    admin: number;
    regular: number;
  };
  machines: {
    total: number;
    active: number;
    inactive: number;
  };
  contests: {
    total: number;
    active: number;
    inactive: number;
  };
  instances: {
    total: number;
    running: number;
    pending: number;
    terminated: number;
  };
  // ✅ 추가
  scenarios: {
    total: number;
    active: number;
    byMode: {
      terminalRace: number;
      defenseBattle: number;
      captureServer: number;
      hackersDeck: number;
      exploitChain: number;
    };
  };
}

const DashboardHome: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    users: { total: 0, admin: 0, regular: 0 },
    machines: { total: 0, active: 0, inactive: 0 },
    contests: { total: 0, active: 0, inactive: 0 },
    instances: { total: 0, running: 0, pending: 0, terminated: 0 },
    scenarios: { 
      total: 0, 
      active: 0,
      byMode: {
        terminalRace: 0,
        defenseBattle: 0,
        captureServer: 0,
        hackersDeck: 0,
        exploitChain: 0
      }
    }
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, machinesRes, contestsRes, instancesRes, scenariosRes] = await Promise.all([
          getAllUser(),
          getAllMachines(),
          getContests(),
          getAllInstances(),
          getAllScenarios(), // ✅ 추가
        ]);

        setStats({
          users: {
            total: usersRes.users.length,
            admin: usersRes.users.filter((user: any) => user.isAdmin).length,
            regular: usersRes.users.filter((user: any) => !user.isAdmin).length,
          },
          machines: {
            total: machinesRes.machines.length,
            active: machinesRes.machines.filter((machine: any) => machine.isActive).length,
            inactive: machinesRes.machines.filter((machine: any) => !machine.isActive).length,
          },
          contests: {
            total: contestsRes.contests.length,
            active: contestsRes.contests.filter((contest: any) => contest.isActive).length,
            inactive: contestsRes.contests.filter((contest: any) => !contest.isActive).length,
          },
          instances: {
            total: instancesRes.instances.length,
            running: instancesRes.instances.filter((instance: any) => instance.status === 'running').length,
            pending: instancesRes.instances.filter((instance: any) => instance.status === 'pending').length,
            terminated: instancesRes.instances.filter((instance: any) => instance.status === 'terminated').length,
          },
          // ✅ 추가
          scenarios: {
            total: scenariosRes.scenarios.length,
            active: scenariosRes.scenarios.filter((s: any) => s.isActive).length,
            byMode: {
              terminalRace: scenariosRes.scenarios.filter((s: any) => s.mode === 'TERMINAL_HACKING_RACE').length,
              defenseBattle: scenariosRes.scenarios.filter((s: any) => s.mode === 'CYBER_DEFENSE_BATTLE').length,
              captureServer: scenariosRes.scenarios.filter((s: any) => s.mode === 'CAPTURE_THE_SERVER').length,
              hackersDeck: scenariosRes.scenarios.filter((s: any) => s.mode === 'HACKERS_DECK').length,
              exploitChain: scenariosRes.scenarios.filter((s: any) => s.mode === 'EXPLOIT_CHAIN_CHALLENGE').length,
            }
          }
        });
      } catch (err: any) {
        console.error('Error fetching dashboard stats:', err);
        setError('Failed to load dashboard statistics.');
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="admin-dashboard">
      <Sidebar />
      <div className="admin-content">
        <h1>Dashboard Home</h1>
        {error && <ErrorMessage message={error} />}
        <div className="stats-container">
          <StatCard 
            title="Users" 
            count={stats.users.total} 
            icon={<FaUsers />}
            details={[
              { label: 'Admins', value: stats.users.admin },
              { label: 'Regular Users', value: stats.users.regular },
            ]}
          />
          <StatCard 
            title="Machines" 
            count={stats.machines.total} 
            icon={<FaServer />}
            details={[
              { label: 'Active', value: stats.machines.active },
              { label: 'Inactive', value: stats.machines.inactive },
            ]}
          />
          <StatCard 
            title="Contests" 
            count={stats.contests.total} 
            icon={<FaClipboardList />}
            details={[
              { label: 'Active', value: stats.contests.active },
              { label: 'Inactive', value: stats.contests.inactive },
            ]}
          />
          <StatCard 
            title="Instances" 
            count={stats.instances.total} 
            icon={<FaCogs />}
            details={[
              { label: 'Running', value: stats.instances.running },
              { label: 'Pending', value: stats.instances.pending },
              { label: 'Terminated', value: stats.instances.terminated },
            ]}
          />
          {/* ✅ 새로 추가: Arena Scenarios */}
          <StatCard 
            title="Arena Scenarios" 
            count={stats.scenarios.total} 
            icon={<FaGamepad />}
            details={[
              { label: 'Active', value: stats.scenarios.active },
              { label: 'Terminal Race', value: stats.scenarios.byMode.terminalRace },
              { label: 'Defense Battle', value: stats.scenarios.byMode.defenseBattle },
              { label: 'Capture Server', value: stats.scenarios.byMode.captureServer },
            ]}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;