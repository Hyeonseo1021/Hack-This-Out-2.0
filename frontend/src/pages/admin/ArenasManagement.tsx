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
      case 'WAITING': return '⏳';
      case 'STARTED': return '🎮';
      case 'ENDED': return '✅';
      default: return '❓';
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'TERMINAL_HACKING_RACE': return '⚡';
      case 'CYBER_DEFENSE_BATTLE': return '⚔️';
      case 'KING_OF_THE_HILL': return '👑';
      case 'FORENSICS_RUSH': return '🔍';
      case 'SOCIAL_ENGINEERING_CHALLENGE': return '💬';
      default: return '🎯';
    }
  };

  const getModeName = (mode: string) => {
    switch (mode) {
      case 'TERMINAL_HACKING_RACE': return 'Terminal Race';
      case 'CYBER_DEFENSE_BATTLE': return 'Defense Battle';
      case 'KING_OF_THE_HILL': return 'King of the Hill';
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
          <h1>🏟️ Arena Rooms Management</h1>
          <div className="header-stats">
            <span className="stat-chip">
              <FaGamepad /> Total: {arenas.length}
            </span>
            <span className="stat-chip waiting">
              ⏳ Waiting: {arenas.filter(r => r.status === 'WAITING').length}
            </span>
            <span className="stat-chip progress">
              🎮 Started: {arenas.filter(r => r.status === 'STARTED').length}
            </span>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        {/* Filters */}
        <div className="filters-section">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="WAITING">⏳ Waiting</option>
            <option value="STARTED">🎮 Started</option>
            <option value="ENDED">✅ Ended</option>
          </select>

          <select value={filterMode} onChange={e => setFilterMode(e.target.value)}>
            <option value="ALL">All Modes</option>
            <option value="TERMINAL_HACKING_RACE">⚡ Terminal Race</option>
            <option value="CYBER_DEFENSE_BATTLE">⚔️ Defense Battle</option>
            <option value="KING_OF_THE_HILL">👑 King of the Hill</option>
            <option value="FORENSICS_RUSH">🔍 Forensics Rush</option>
            <option value="SOCIAL_ENGINEERING_CHALLENGE">💬 Social Engineering</option>
          </select>

          <input
            type="text"
            placeholder="🔍 Search by arena name, host, or scenario..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
          />

          <button onClick={loadArenas} className="refresh-btn" disabled={loading}>
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
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
                  <td colSpan={9} className="empty-state">
                    No arenas found.
                  </td>
                </tr>
              ) : (
                filteredArenas.map(arena => (
                  <tr key={arena._id} className={`arena-row ${arena.status.toLowerCase()}`}>
                    <td>
                      <code className="arena-code">{arena.name}</code>
                    </td>
                    <td>
                      <span className="mode-badge">
                        {getModeIcon(arena.gameMode)} {getModeName(arena.gameMode)}
                      </span>
                    </td>
                    <td>
                      {arena.scenario ? (
                        <div>
                          <strong>{arena.scenario.title}</strong>
                          <span className={`difficulty-badge ${arena.scenario.difficulty.toLowerCase()}`}>
                            {arena.scenario.difficulty}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">No scenario</span>
                      )}
                    </td>
                    <td>
                      <div className="host-info">
                        <FaUsers className="icon" />
                        {arena.host.username}
                      </div>
                    </td>
                    <td>
                      <span className="players-count">
                        {arena.currentPlayers} / {arena.maxPlayers}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(arena.status)}`}>
                        {getStatusIcon(arena.status)} {arena.status}
                      </span>
                    </td>
                    <td>
                      <small>{formatDate(arena.createdAt)}</small>
                    </td>
                    <td>
                      <span className="duration">
                        <FaClock className="icon" />
                        {getDuration(arena)}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          onClick={() => handleViewDetails(arena._id!)} 
                          title="View Details"
                          className="btn-view"
                        >
                          <FaEye />
                        </button>
                        <button 
                          onClick={() => handleDelete(arena._id!, arena.name)} 
                          title="Delete Arena"
                          className="btn-delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        <div className="arenas-summary">
          Showing {filteredArenas.length} of {arenas.length} arenas
          {filterStatus !== 'ALL' && ` | Status: ${filterStatus}`}
          {filterMode !== 'ALL' && ` | Mode: ${getModeName(filterMode)}`}
        </div>

        {/* Arena Details Modal */}
        {showDetailsModal && selectedArena && (
          <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🏟️ Arena Details</h2>
                <button className="close-btn" onClick={() => setShowDetailsModal(false)}>✕</button>
              </div>
              
              <div className="modal-body">
                <div className="detail-section">
                  <h3>Basic Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Arena Name:</label>
                      <code>{selectedArena.name}</code>
                    </div>
                    <div className="detail-item">
                      <label>Game Mode:</label>
                      <span>{getModeIcon(selectedArena.gameMode)} {getModeName(selectedArena.gameMode)}</span>
                    </div>
                    <div className="detail-item">
                      <label>Status:</label>
                      <span className={`status-badge ${getStatusBadgeClass(selectedArena.status)}`}>
                        {getStatusIcon(selectedArena.status)} {selectedArena.status}
                      </span>
                    </div>
                    <div className="detail-item">
                      <label>Host:</label>
                      <span>{selectedArena.host.username}</span>
                    </div>
                  </div>
                </div>

                {selectedArena.scenario && (
                  <div className="detail-section">
                    <h3>Scenario</h3>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <label>Title:</label>
                        <span>{selectedArena.scenario.title}</span>
                      </div>
                      <div className="detail-item">
                        <label>Difficulty:</label>
                        <span className={`difficulty-badge ${selectedArena.scenario.difficulty.toLowerCase()}`}>
                          {selectedArena.scenario.difficulty}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="detail-section">
                  <h3>Settings</h3>
                  <div className="settings-list">
                    <div className="setting-item">
                      <span>{selectedArena.settings.endOnFirstSolve ? '🏁' : '⏱️'}</span>
                      <span>{selectedArena.settings.endOnFirstSolve ? 'End on First Solve' : 'Continue Until Time Ends'}</span>
                    </div>
                    <div className="setting-item">
                      <span>⏳</span>
                      <span>Grace Period: {Math.floor(selectedArena.settings.graceMs / 1000)}s</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Participants ({selectedArena.participants.length}/{selectedArena.maxPlayers})</h3>
                  <div className="participants-list">
                    {selectedArena.participants.length === 0 ? (
                      <p className="text-muted">No participants yet</p>
                    ) : (
                      selectedArena.participants.map((p, idx) => (
                        <div key={idx} className="participant-item">
                          <span className="participant-name">{p.username}</span>
                          {p.team && <span className="participant-team">{p.team}</span>}
                          <span className="participant-joined">{formatDate(p.joinedAt)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Timeline</h3>
                  <div className="timeline">
                    <div className="timeline-item">
                      <strong>Created:</strong> {formatDate(selectedArena.createdAt)}
                    </div>
                    {selectedArena.startedAt && (
                      <div className="timeline-item">
                        <strong>Started:</strong> {formatDate(selectedArena.startedAt)}
                      </div>
                    )}
                    {selectedArena.completedAt && (
                      <div className="timeline-item">
                        <strong>Completed:</strong> {formatDate(selectedArena.completedAt)}
                      </div>
                    )}
                    <div className="timeline-item">
                      <strong>Duration:</strong> {getDuration(selectedArena)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  className="btn-danger" 
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleDelete(selectedArena._id!, selectedArena.name);
                  }}
                >
                  🗑️ Delete Arena
                </button>
                <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArenasManagement;