import React, { useEffect, useState } from 'react';
import { 
  getAllScenarios, 
  createScenario, 
  updateScenario, 
  deleteScenario, 
  toggleScenarioActive,
  getScenarioById 
} from '../../api/axiosScenario';
import Sidebar from '../../components/admin/AdminSidebar';
import ErrorMessage from '../../components/admin/ErrorMessage';
import TerminalRaceForm from '../../components/admin/forms/TerminalRaceForm';
import DefenseBattleForm from '../../components/admin/forms/DefenseBattleForm';
import CaptureServerForm from '../../components/admin/forms/CaptureServerForm';
import HackersDeckForm from '../../components/admin/forms/HackersDeckForm';
import ExploitChainForm from '../../components/admin/forms/ExploitChainForm';
import { FaEdit, FaTrash, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import '../../assets/scss/admin/ScenariosManagement.scss';

interface Scenario {
  _id?: string;
  mode: string;
  difficulty: string;
  title: string;
  description: string;
  timeLimit: number;
  isActive: boolean;
  usageCount?: number;
  data: any;
}

const getInitialData = (mode: string) => {
  switch (mode) {
    case 'TERMINAL_HACKING_RACE':
      return {
        totalStages: 1,
        stages: [{ stage: 1, prompt: '', commands: [] }]
      };
    case 'CYBER_DEFENSE_BATTLE':
      return {
        duration: 900,
        teams: ['RED', 'BLUE'],
        actions: [],
        startingHealth: 100
      };
    case 'CAPTURE_THE_SERVER':
      return {
        totalServers: 0,
        servers: []
      };
    case 'HACKERS_DECK':
      return {
        totalTurns: 10,
        startingPoints: 100,
        cards: []
      };
    case 'EXPLOIT_CHAIN_CHALLENGE':
      return {
        totalChains: 0,
        chains: []
      };
    default:
      return { totalStages: 0, stages: [] };
  }
};

const initialForm: Scenario = {
  mode: 'TERMINAL_HACKING_RACE',
  difficulty: 'EASY',
  title: '',
  description: '',
  timeLimit: 600,
  isActive: true,
  data: getInitialData('TERMINAL_HACKING_RACE')
};

const ScenariosManagement: React.FC = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [form, setForm] = useState<Scenario>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterMode, setFilterMode] = useState<string>('ALL');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadScenarios();
  }, []);

  const loadScenarios = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAllScenarios();
      setScenarios(res.scenarios);
    } catch (err: any) {
      setError('Failed to load scenarios.');
    } finally {
      setLoading(false);
    }
  };

  const filteredScenarios = scenarios.filter(s => {
    if (filterMode !== 'ALL' && s.mode !== filterMode) return false;
    if (filterDifficulty !== 'ALL' && s.difficulty !== filterDifficulty) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (!s.title.toLowerCase().includes(query) && 
          !s.description?.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  const handleModeChange = (newMode: string) => {
    setForm(prev => ({
      ...prev,
      mode: newMode,
      data: getInitialData(newMode)
    }));
  };

  const validateForm = () => {
    if (!form.title.trim()) {
      alert('Title is required');
      return false;
    }

    switch (form.mode) {
      case 'TERMINAL_HACKING_RACE':
        if (form.data.stages.length === 0) {
          alert('At least one stage is required');
          return false;
        }
        for (let i = 0; i < form.data.stages.length; i++) {
          if (!form.data.stages[i].prompt.trim()) {
            alert(`Stage ${i + 1} prompt is required`);
            return false;
          }
          if (form.data.stages[i].commands.length === 0) {
            alert(`Stage ${i + 1} must have at least one command`);
            return false;
          }
        }
        break;

      case 'CYBER_DEFENSE_BATTLE':
        if (form.data.actions.length === 0) {
          alert('At least one action is required');
          return false;
        }
        break;

      case 'CAPTURE_THE_SERVER':
        if (form.data.servers.length === 0) {
          alert('At least one server is required');
          return false;
        }
        break;

      case 'HACKERS_DECK':
        if (form.data.cards.length === 0) {
          alert('At least one card is required');
          return false;
        }
        break;

      case 'EXPLOIT_CHAIN_CHALLENGE':
        if (form.data.chains.length === 0) {
          alert('At least one chain is required');
          return false;
        }
        for (let i = 0; i < form.data.chains.length; i++) {
          if (form.data.chains[i].vulnerabilities.length === 0) {
            alert(`Chain ${i + 1} must have at least one vulnerability`);
            return false;
          }
        }
        break;
    }

    return true;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateScenario(editingId, form);
        await loadScenarios();
        alert('Scenario updated successfully!');
      } else {
        const created = await createScenario(form);
        setScenarios(prev => [created.scenario, ...prev]);
        alert('Scenario created successfully!');
      }
      setForm(initialForm);
      setEditingId(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to save scenario';
      setError(msg);
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (scenario: Scenario) => {
    try {
      const res = await getScenarioById(scenario._id!);
      setForm(res.scenario);
      setEditingId(scenario._id!);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert('Failed to load scenario details');
    }
  };

  const handleCancelEdit = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      await toggleScenarioActive(id, !currentStatus);
      setScenarios(prev => prev.map(s => s._id === id ? { ...s, isActive: !currentStatus } : s));
    } catch (err) {
      alert('Failed to toggle scenario status.');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await deleteScenario(id);
      setScenarios(prev => prev.filter(s => s._id !== id));
      alert('Scenario deleted!');
    } catch (err) {
      alert('Failed to delete scenario.');
    }
  };

  const getModeIcon = (mode: string) => {
    const icons: Record<string, string> = {
      'TERMINAL_HACKING_RACE': '⚡',
      'CYBER_DEFENSE_BATTLE': '⚔️',
      'CAPTURE_THE_SERVER': '🏰',
      'HACKERS_DECK': '🎲',
      'EXPLOIT_CHAIN_CHALLENGE': '🎯'
    };
    return icons[mode] || '📝';
  };

  const getModeName = (mode: string) => {
    const names: Record<string, string> = {
      'TERMINAL_HACKING_RACE': 'Terminal Race',
      'CYBER_DEFENSE_BATTLE': 'Defense Battle',
      'CAPTURE_THE_SERVER': 'Capture Server',
      'HACKERS_DECK': "Hacker's Deck",
      'EXPLOIT_CHAIN_CHALLENGE': 'Exploit Chain'
    };
    return names[mode] || mode;
  };

  const getStageCount = (scenario: Scenario) => {
    switch (scenario.mode) {
      case 'TERMINAL_HACKING_RACE':
        return scenario.data?.totalStages || 0;
      case 'CYBER_DEFENSE_BATTLE':
        return scenario.data?.actions?.length || 0;
      case 'CAPTURE_THE_SERVER':
        return scenario.data?.totalServers || 0;
      case 'HACKERS_DECK':
        return scenario.data?.cards?.length || 0;
      case 'EXPLOIT_CHAIN_CHALLENGE':
        return scenario.data?.totalChains || 0;
      default:
        return 0;
    }
  };

  return (
    <div className="admin-dashboard">
      <Sidebar />

      <div className="admin-content scenarios-management">
        <h1>Arena Scenarios Management</h1>
        {error && <ErrorMessage message={error} />}

        {/* 생성/수정 폼 */}
        <div className={`form-container ${editingId ? 'editing' : ''}`}>
          <h2>{editingId ? '✏️ Edit Scenario' : '➕ Create New Scenario'}</h2>
          
          <form onSubmit={onSubmit}>
            {/* 기본 정보 */}
            <div className="basic-info">
              <div className="form-row-3">
                <div className="form-group">
                  <label>Mode *</label>
                  <select 
                    value={form.mode} 
                    onChange={e => handleModeChange(e.target.value)}
                    required
                    disabled={editingId !== null}
                  >
                    <option value="TERMINAL_HACKING_RACE">⚡ Terminal Race</option>
                    <option value="CYBER_DEFENSE_BATTLE">⚔️ Defense Battle</option>
                    <option value="CAPTURE_THE_SERVER">🏰 Capture Server</option>
                    <option value="HACKERS_DECK">🎲 Hacker's Deck</option>
                    <option value="EXPLOIT_CHAIN_CHALLENGE">🎯 Exploit Chain</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Difficulty *</label>
                  <select 
                    value={form.difficulty} 
                    onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
                    required
                  >
                    <option value="EASY">🟢 Easy</option>
                    <option value="MEDIUM">🟡 Medium</option>
                    <option value="HARD">🔴 Hard</option>
                    <option value="EXPERT">💀 Expert</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Time Limit (seconds) *</label>
                  <input
                    type="number"
                    min={60}
                    max={3600}
                    step={60}
                    value={form.timeLimit}
                    onChange={e => setForm(f => ({ ...f, timeLimit: Number(e.target.value) }))}
                    required
                  />
                  <small>{Math.floor(form.timeLimit / 60)} minutes</small>
                </div>
              </div>

              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  placeholder="e.g., Corporate Network Breach"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                />
                <div>
                  <strong>Include in Random Pool</strong>
                  <small style={{ display: 'block', color: '#999', fontSize: '11px', marginTop: '2px' }}>
                    If checked, this scenario can be randomly assigned to matches
                  </small>
                </div>
              </label>
            </div>

            {/* 모드별 폼 */}
            <div className="mode-data-section">
              {form.mode === 'TERMINAL_HACKING_RACE' && (
                <TerminalRaceForm
                  data={form.data}
                  onChange={(data) => setForm(f => ({ ...f, data }))}
                />
              )}

              {form.mode === 'CYBER_DEFENSE_BATTLE' && (
                <DefenseBattleForm
                  data={form.data}
                  onChange={(data) => setForm(f => ({ ...f, data }))}
                />
              )}

              {form.mode === 'CAPTURE_THE_SERVER' && (
                <CaptureServerForm
                  data={form.data}
                  onChange={(data) => setForm(f => ({ ...f, data }))}
                />
              )}

              {form.mode === 'HACKERS_DECK' && (
                <HackersDeckForm
                  data={form.data}
                  onChange={(data) => setForm(f => ({ ...f, data }))}
                />
              )}

              {form.mode === 'EXPLOIT_CHAIN_CHALLENGE' && (
                <ExploitChainForm
                  data={form.data}
                  onChange={(data) => setForm(f => ({ ...f, data }))}
                />
              )}
            </div>

            <div className="form-actions">
              <button type="submit" disabled={saving}>
                {saving ? 'Saving...' : (editingId ? '💾 Update' : '✨ Create')}
              </button>
              <button type="button" onClick={handleCancelEdit} disabled={saving}>
                {editingId ? '✖️ Cancel' : '🔄 Reset'}
              </button>
            </div>
          </form>
        </div>

        {/* 필터 */}
        <div className="filters-section">
          <select value={filterMode} onChange={e => setFilterMode(e.target.value)}>
            <option value="ALL">All Modes</option>
            <option value="TERMINAL_HACKING_RACE">⚡ Terminal Race</option>
            <option value="CYBER_DEFENSE_BATTLE">⚔️ Defense Battle</option>
            <option value="CAPTURE_THE_SERVER">🏰 Capture Server</option>
            <option value="HACKERS_DECK">🎲 Hacker's Deck</option>
            <option value="EXPLOIT_CHAIN_CHALLENGE">🎯 Exploit Chain</option>
          </select>

          <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
            <option value="ALL">All Difficulties</option>
            <option value="EASY">🟢 Easy</option>
            <option value="MEDIUM">🟡 Medium</option>
            <option value="HARD">🔴 Hard</option>
            <option value="EXPERT">💀 Expert</option>
          </select>

          <input
            type="text"
            placeholder="Search by title or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 테이블 */}
        {loading ? (
          <div className="loading-state">Loading scenarios...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Mode</th>
                <th>Title</th>
                <th>Difficulty</th>
                <th>Time</th>
                <th>Items</th>
                <th>Usage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredScenarios.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    No scenarios found.
                  </td>
                </tr>
              ) : (
                filteredScenarios.map(s => (
                  <tr key={s._id}>
                    <td>
                      <span className="mode-icon">{getModeIcon(s.mode)}</span>
                      {getModeName(s.mode)}
                    </td>
                    <td>
                      <strong>{s.title}</strong>
                      {s.description && (
                        <div className="description-preview">
                          {s.description.substring(0, 50)}{s.description.length > 50 ? '...' : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`difficulty-badge ${s.difficulty.toLowerCase()}`}>
                        {s.difficulty}
                      </span>
                    </td>
                    <td>{Math.floor(s.timeLimit / 60)}m</td>
                    <td>{getStageCount(s)}</td>
                    <td>{s.usageCount || 0}</td>
                    <td>
                      <span className={`status-badge ${s.isActive ? 'active' : 'inactive'}`}>
                        {s.isActive ? '✅ Active' : '❌ Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          onClick={() => handleEdit(s)} 
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        <button 
                          onClick={() => handleToggle(s._id!, s.isActive)} 
                          title={s.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {s.isActive ? <FaToggleOff /> : <FaToggleOn />}
                        </button>
                        <button 
                          onClick={() => handleDelete(s._id!, s.title)} 
                          title="Delete"
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

        <div className="scenarios-summary">
          Showing {filteredScenarios.length} of {scenarios.length} scenarios
          {filterMode !== 'ALL' && ` | Mode: ${getModeName(filterMode)}`}
          {filterDifficulty !== 'ALL' && ` | Difficulty: ${filterDifficulty}`}
        </div>
      </div>
    </div>
  );
};

export default ScenariosManagement;