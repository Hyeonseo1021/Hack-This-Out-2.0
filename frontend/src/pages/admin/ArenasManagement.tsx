import React, { useEffect, useState } from 'react';
import {
  getAllArenas,
  deleteArena,
  getArenaById
} from '../../api/axiosArena';
import Sidebar from '../../components/admin/AdminSidebar';
import ErrorMessage from '../../components/admin/ErrorMessage';
import '../../assets/scss/admin/DataTable.scss';

interface Arena {
  _id?: string;
  arenaId: string;
  name: string;
  gameMode: string;
  scenario?: {
    _id: string;
    title: string | { ko: string; en: string };
    difficulty: string;
    mode: string;
  };
  maxPlayers: number;
  currentPlayers: number;
  participants: Array<{
    userId: string;
    username: string;
    team?: string;
    joinedAt: Date;
  }>;
  status: 'WAITING' | 'STARTED' | 'ENDED';
  host: {
    userId: string;
    username: string;
  };
  settings: {
    endOnFirstSolve: boolean;
    graceMs: number;
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

const ArenasManagement: React.FC = () => {
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedArena, setSelectedArena] = useState<Arena | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadArenas();
  }, []);

  const loadArenas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAllArenas();
      setArenas(res.arenas);
    } catch (err: any) {
      setError('Failed to load arenas.');
      console.error('Error loading rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (arenaId: string, arenaName: string) => {
    if (!window.confirm(`Are you sure you want to delete arena "${arenaName}"?\n\nThis will:\n- Remove the arena from the database\n- Kick all participants\n- This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteArena(arenaId);
      setArenas(arenas.filter(r => r._id !== arenaId));
      alert(`Arena "${arenaName}" has been successfully deleted.`);
    } catch (err: any) {
      console.error('Error deleting arena:', err);
      alert(`Failed to delete arena: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleViewDetails = async (arenaId: string) => {
    try {
      const res = await getArenaById(arenaId);
      setSelectedArena(res.arena);
      setShowDetailsModal(true);
    } catch (err: any) {
      console.error('Error fetching arena details:', err);
      alert('Failed to load arena details.');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'WAITING': return 'status-pending';
      case 'STARTED': return 'status-running';
      case 'ENDED': return 'status-terminated';
      default: return '';
    }
  };

  const getModeName = (mode: string) => {
    switch (mode) {
      case 'TERMINAL_HACKING_RACE': return 'Terminal Race';
      case 'VULNERABILITY_SCANNER_RACE': return 'Vulnerability Scanner Race';
      case 'FORENSICS_RUSH': return 'Forensics Rush';
      case 'SOCIAL_ENGINEERING_CHALLENGE': return 'Social Engineering';
      default: return mode;
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDuration = (arena: Arena) => {
    if (!arena.startedAt) return 'Not started';
    
    const start = new Date(arena.startedAt).getTime();
    const end = arena.completedAt ? new Date(arena.completedAt).getTime() : Date.now();
    const durationMs = end - start;
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="admin-dashboard">
      <Sidebar />
      <div className="admin-content">
        <h1>Arenas Management</h1>
        {error && <ErrorMessage message={error} />}

        {loading ? (
          <div>Loading arenas...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Arena Name</th>
                <th>Game Mode</th>
                <th>Scenario</th>
                <th>Host</th>
                <th>Players</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {arenas.length === 0 ? (
                <tr>
                  <td colSpan={8}>No arenas found.</td>
                </tr>
              ) : (
                arenas.map(arena => (
                  <tr key={arena._id}>
                    <td>{arena.name}</td>
                    <td>{getModeName(arena.gameMode)}</td>
                    <td>
                      {arena.scenario ? (
                        <div>
                          <div>{typeof arena.scenario.title === 'string' ? arena.scenario.title : arena.scenario.title?.en || arena.scenario.title?.ko}</div>
                          <small>({arena.scenario.difficulty})</small>
                        </div>
                      ) : (
                        'No scenario'
                      )}
                    </td>
                    <td>{arena.host.username}</td>
                    <td>{arena.currentPlayers}/{arena.maxPlayers}</td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(arena.status)}`}>
                        {arena.status}
                      </span>
                    </td>
                    <td>{formatDate(arena.createdAt)}</td>
                    <td>
                      <div className="action-buttons">
                        <button onClick={() => handleViewDetails(arena._id!)}>
                          View
                        </button>
                        <button className="delete-button" onClick={() => handleDelete(arena._id!, arena.name)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedArena && (
          <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Arena Details</h2>
                <button className="close-btn" onClick={() => setShowDetailsModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="detail-section">
                  <h3>Basic Information</h3>
                  <p><strong>Arena Name:</strong> {selectedArena.name}</p>
                  <p><strong>Game Mode:</strong> {getModeName(selectedArena.gameMode)}</p>
                  <p><strong>Status:</strong> {selectedArena.status}</p>
                  <p><strong>Host:</strong> {selectedArena.host.username}</p>
                  <p><strong>Players:</strong> {selectedArena.currentPlayers}/{selectedArena.maxPlayers}</p>
                  <p><strong>Created:</strong> {formatDate(selectedArena.createdAt)}</p>
                  {selectedArena.startedAt && <p><strong>Started:</strong> {formatDate(selectedArena.startedAt)}</p>}
                  {selectedArena.completedAt && <p><strong>Completed:</strong> {formatDate(selectedArena.completedAt)}</p>}
                  <p><strong>Duration:</strong> {getDuration(selectedArena)}</p>
                </div>

                {selectedArena.scenario && (
                  <div className="detail-section">
                    <h3>Scenario</h3>
                    <p><strong>Title:</strong> {typeof selectedArena.scenario.title === 'string' ? selectedArena.scenario.title : selectedArena.scenario.title?.en || selectedArena.scenario.title?.ko}</p>
                    <p><strong>Difficulty:</strong> {selectedArena.scenario.difficulty}</p>
                  </div>
                )}

                <div className="detail-section">
                  <h3>Participants ({selectedArena.participants.length})</h3>
                  <ul>
                    {selectedArena.participants.map(p => (
                      <li key={p.userId}>
                        {p.username} - Joined: {formatDate(p.joinedAt)}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="detail-section">
                  <h3>Settings</h3>
                  <p><strong>End on First Solve:</strong> {selectedArena.settings.endOnFirstSolve ? 'Yes' : 'No'}</p>
                  <p><strong>Grace Period:</strong> {(selectedArena.settings.graceMs / 1000).toFixed(0)}s</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArenasManagement;