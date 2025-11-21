import React, { useEffect, useState } from 'react';
import { 
  getAllArenas, 
  deleteArena,
  getArenaById 
} from '../../api/axiosArena';
import Sidebar from '../../components/admin/AdminSidebar';
import ErrorMessage from '../../components/admin/ErrorMessage';
import { FaEye, FaTrash, FaUsers, FaGamepad, FaClock } from 'react-icons/fa';
import '../../assets/scss/admin/ArenasManagement.scss';

interface Arena {
  _id?: string;
  arenaId: string;
  name: string;
  gameMode: string;
  scenario?: {
    _id: string;
    title: string;
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

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterMode, setFilterMode] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const filteredArenas = arenas.filter(r => {
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    if (filterMode !== 'ALL' && r.gameMode !== filterMode) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (!r.name.toLowerCase().includes(query) && 
          !r.host.username.toLowerCase().includes(query) &&
          !r.scenario?.title.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

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
      case 'WAITING': return 'status-waiting';
      case 'STARTED': return 'status-progress';
      case 'ENDED': return 'status-completed';
      default: return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'WAITING': return '';
      case 'STARTED': return '';
      case 'ENDED': return '';
      default: return '';
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'TERMINAL_HACKING_RACE': return '';
      case 'VULNERABILITY_SCANNER_RACE': return '';
      case 'FORENSICS_RUSH': return '';
      case 'SOCIAL_ENGINEERING_CHALLENGE': return '';
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
        <div className="page-header">
          <h1>Arena Rooms Management</h1>
          <div className="header-stats">
            <span className="stat-chip">
              <FaGamepad /> Total: {arenas.length}
            </span>
            <span className="stat-chip waiting">
              Waiting: {arenas.filter(r => r.status === 'WAITING').length}
            </span>
            <span className="stat-chip progress">
              Started: {arenas.filter(r => r.status === 'STARTED').length}
            </span>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        {/* Filters */}
        <div className="filters-section">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="WAITING">Waiting</option>
            <option value="STARTED">Started</option>
            <option value="ENDED">Ended</option>
          </select>

          <select value={filterMode} onChange={e => setFilterMode(e.target.value)}>
            <option value="ALL">All Modes</option>
            <option value="TERMINAL_HACKING_RACE">Terminal Race</option>
            <option value="VULNERABILITY_SCANNER_RACE">Vulnerability Scanner Race</option>
            <option value="FORENSICS_RUSH">Forensics Rush</option>
            <option value="SOCIAL_ENGINEERING_CHALLENGE">Social Engineering</option>
          </select>

          <input
            type="text"
            placeholder="Search by arena name, host, or scenario..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
          />

          <button onClick={loadArenas} className="refresh-btn" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading-state">Loading arenas...</div>
        ) : (
          <table className="data-table arenas-table">
            <thead>
              <tr>
                <th>Arena Name</th>
                <th>Game Mode</th>
                <th>Scenario</th>
                <th>Host</th>
                <th>Players</th>
                <th>Status</th>
                <th>Created</th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredArenas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="no-data">
                    {searchQuery.trim() || filterStatus !== 'ALL' || filterMode !== 'ALL'
                      ? 'No arenas match your filters.'
                      : 'No arenas found.'}
                  </td>
                </tr>
              ) : (
                filteredArenas.map(arena => (
                  <tr key={arena._id}>
                    <td className="arena-name-cell">
                      <strong>{arena.name}</strong>
                    </td>
                    <td>
                      <span className="mode-badge">
                        {getModeIcon(arena.gameMode)} {getModeName(arena.gameMode)}
                      </span>
                    </td>
                    <td>
                      {arena.scenario ? (
                        <div className="scenario-info">
                          <div className="scenario-title">{arena.scenario.title}</div>
                          <div className="scenario-difficulty">{arena.scenario.difficulty}</div>
                        </div>
                      ) : (
                        <span className="text-muted">No scenario</span>
                      )}
                    </td>
                    <td>{arena.host.username}</td>
                    <td>
                      <span className="players-badge">
                        <FaUsers /> {arena.currentPlayers}/{arena.maxPlayers}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(arena.status)}`}>
                        {getStatusIcon(arena.status)} {arena.status}
                      </span>
                    </td>
                    <td className="text-muted">
                      <FaClock /> {formatDate(arena.createdAt)}
                    </td>
                    <td>{getDuration(arena)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-view"
                          onClick={() => handleViewDetails(arena._id!)}
                          title="View Details"
                        >
                          <FaEye /> View
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDelete(arena._id!, arena.name)}
                          title="Delete Arena"
                        >
                          <FaTrash /> Delete
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
                <button className="close-btn" onClick={() => setShowDetailsModal(false)}>X</button>
              </div>
              <div className="modal-body">
                <div className="detail-section">
                  <h3>Basic Information</h3>
                  <table className="detail-table">
                    <tbody>
                      <tr>
                        <td><strong>Arena Name:</strong></td>
                        <td>{selectedArena.name}</td>
                      </tr>
                      <tr>
                        <td><strong>Game Mode:</strong></td>
                        <td>{getModeIcon(selectedArena.gameMode)} {getModeName(selectedArena.gameMode)}</td>
                      </tr>
                      <tr>
                        <td><strong>Status:</strong></td>
                        <td>
                          <span className={`status-badge ${getStatusBadgeClass(selectedArena.status)}`}>
                            {getStatusIcon(selectedArena.status)} {selectedArena.status}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Host:</strong></td>
                        <td>{selectedArena.host.username}</td>
                      </tr>
                      <tr>
                        <td><strong>Players:</strong></td>
                        <td>{selectedArena.currentPlayers}/{selectedArena.maxPlayers}</td>
                      </tr>
                      <tr>
                        <td><strong>Created:</strong></td>
                        <td>{formatDate(selectedArena.createdAt)}</td>
                      </tr>
                      {selectedArena.startedAt && (
                        <tr>
                          <td><strong>Started:</strong></td>
                          <td>{formatDate(selectedArena.startedAt)}</td>
                        </tr>
                      )}
                      {selectedArena.completedAt && (
                        <tr>
                          <td><strong>Completed:</strong></td>
                          <td>{formatDate(selectedArena.completedAt)}</td>
                        </tr>
                      )}
                      <tr>
                        <td><strong>Duration:</strong></td>
                        <td>{getDuration(selectedArena)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {selectedArena.scenario && (
                  <div className="detail-section">
                    <h3>Scenario</h3>
                    <table className="detail-table">
                      <tbody>
                        <tr>
                          <td><strong>Title:</strong></td>
                          <td>{selectedArena.scenario.title}</td>
                        </tr>
                        <tr>
                          <td><strong>Difficulty:</strong></td>
                          <td>{selectedArena.scenario.difficulty}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="detail-section">
                  <h3>Participants ({selectedArena.participants.length})</h3>
                  <table className="participants-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Joined At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedArena.participants.map(p => (
                        <tr key={p.userId}>
                          <td>{p.username}</td>
                          <td>{formatDate(p.joinedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="detail-section">
                  <h3>Settings</h3>
                  <table className="detail-table">
                    <tbody>
                      <tr>
                        <td><strong>End on First Solve:</strong></td>
                        <td>{selectedArena.settings.endOnFirstSolve ? 'Yes' : 'No'}</td>
                      </tr>
                      <tr>
                        <td><strong>Grace Period:</strong></td>
                        <td>{(selectedArena.settings.graceMs / 1000).toFixed(0)}s</td>
                      </tr>
                    </tbody>
                  </table>
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