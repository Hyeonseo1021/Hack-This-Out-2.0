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
import ForensicsRushForm from '../../components/admin/forms/ForensicsRushForm';
import SocialEngineeringForm from '../../components/admin/forms/SocialEngineeringForm';
import VulnerabilityScannerRaceForm from '../../components/admin/forms/VulnerablilityScannerRaceForm';
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

// ✅ 모든 모드의 초기 데이터 구조
const getInitialData = (mode: string) => {
  switch (mode) {
    case 'TERMINAL_HACKING_RACE':
      return {
        totalStages: 1,
        stages: [{ 
          stage: 1, 
          prompt: '', 
          commands: [],
          defaultResponse: '유효하지 않은 명령어입니다.'
        }]
      };
      
    case 'VULNERABILITY_SCANNER_RACE':
      return {
        mode: 'SIMULATED', // ✅ 추가: SIMULATED 또는 REAL
        targetUrl: '',
        targetName: '',
        targetDescription: '',
        features: [],
        vulnerabilities: [],
        hints: [],
        scoring: {
          firstBloodBonus: 50,
          speedBonusThresholds: {
            under3min: 30,
            under5min: 20,
            under7min: 10
          },
          comboMultiplier: 5,
          invalidSubmissionPenalty: 5
        },
        totalVulnerabilities: 0
      };

    case 'FORENSICS_RUSH':
      return {
        scenario: {
          title: '',
          description: '',
          incidentType: 'ransomware',
          date: '',
          context: ''
        },
        evidenceFiles: [],
        availableTools: ['grep', 'awk', 'sed', 'wireshark', 'volatility'],
        questions: [],
        scoring: {
          wrongAnswerPenalty: 5,
          perfectScoreBonus: 50,
          speedBonus: true
        },
        totalQuestions: 0
      };

    case 'SOCIAL_ENGINEERING_CHALLENGE':
      return {
        scenarioType: 'IT_HELPDESK',
        objective: {
          title: '',
          description: '',
          targetInformation: []
        },
        aiTarget: {
          name: '',
          role: '',
          department: '',
          personality: {
            helpfulness: 8,
            securityAwareness: 3,
            authorityRespect: 7,
            skepticism: 4
          },
          suspicionThreshold: 70,
          knownInfo: [],
          secretInfo: []
        },
        availableTechniques: [],
        conversationRules: {
          maxTurns: 20,
          turnTimeLimit: undefined,
          warningThresholds: [30, 60, 90]
        },
        scoring: {
          objectiveComplete: 100,
          turnEfficiency: {
            maxBonus: 50,
            optimalTurns: 10
          },
          suspicionManagement: {
            bonus: 30,
            threshold: 30
          },
          naturalnessBonus: {
            maxPoints: 20,
            evaluationCriteria: ['대화 흐름', '자연스러운 질문', '상황에 맞는 반응']
          }
        }
      };
      
    default:
      return { totalStages: 1, stages: [] };
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
        if (form.data.stages?.length === 0) {
          alert('At least one stage is required');
          return false;
        }
        for (let i = 0; i < (form.data.stages?.length || 0); i++) {
          if (!form.data.stages[i].prompt?.trim()) {
            alert(`Stage $${i + 1} prompt is required`);
            return false;
          }
          if (form.data.stages[i].commands?.length === 0) {
            alert(`Stage $${i + 1} must have at least one command`);
            return false;
          }
        }
        break;


      case 'VULNERABILITY_SCANNER_RACE':
        // 필수 필드 검증
        if (!form.data.targetName?.trim()) {
          alert('Target name is required');
          return false;
        }

        if (!form.data.targetDescription?.trim()) {
          alert('Target description is required');
          return false;
        }

        // 난이도 기반 모드 검증
        const isEasyOrMedium = form.difficulty === 'EASY' || form.difficulty === 'MEDIUM';
        const isHardOrExpert = form.difficulty === 'HARD' || form.difficulty === 'EXPERT';

        // EASY/MEDIUM: SIMULATED 모드 강제, features 필수
        if (isEasyOrMedium) {
          if (form.data.mode !== 'SIMULATED') {
            alert('EASY and MEDIUM difficulties must use SIMULATED mode (AI-generated HTML)');
            return false;
          }

          if (!form.data.features || form.data.features.length === 0) {
            alert('Features are required for SIMULATED mode (EASY/MEDIUM difficulty)');
            return false;
          }

          // targetUrl은 무시/초기화
          form.data.targetUrl = '';
        }

        // HARD/EXPERT: REAL 모드 강제, targetUrl 필수
        if (isHardOrExpert) {
          if (form.data.mode !== 'REAL') {
            alert('HARD and EXPERT difficulties must use REAL mode (actual URL)');
            return false;
          }

          if (!form.data.targetUrl?.trim()) {
            alert('Target URL is required for REAL mode (HARD/EXPERT difficulty)');
            return false;
          }

          // URL 형식 검증
          try {
            new URL(form.data.targetUrl);
          } catch (error) {
            alert('Target URL must be a valid URL (e.g., https://example.com)');
            return false;
          }
        }
        
        // Vulnerabilities 배열 검증
        if (!form.data.vulnerabilities || form.data.vulnerabilities.length === 0) {
          alert('At least one vulnerability is required');
          return false;
        }
        
        // 각 취약점 검증
        for (let i = 0; i < form.data.vulnerabilities.length; i++) {
          const vuln = form.data.vulnerabilities[i];

          if (!vuln.vulnName?.trim()) {
            alert(`Vulnerability ${i + 1}: Name is required`);
            return false;
          }

          if (!vuln.vulnType?.trim()) {
            alert(`Vulnerability ${i + 1}: Type is required`);
            return false;
          }

          if (!vuln.severity?.trim()) {
            alert(`Vulnerability ${i + 1}: Severity is required`);
            return false;
          }

          // Severity 값 검증
          const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
          if (!validSeverities.includes(vuln.severity.toUpperCase())) {
            alert(`Vulnerability ${i + 1}: Severity must be LOW, MEDIUM, HIGH, or CRITICAL`);
            return false;
          }

          if (typeof vuln.points !== 'number' || vuln.points <= 0) {
            alert(`Vulnerability ${i + 1}: Points must be a positive number`);
            return false;
          }
        }
        
        // Scoring 검증
        if (!form.data.scoring) {
          alert('Scoring configuration is required');
          return false;
        }
        
        if (typeof form.data.scoring.firstBloodBonus !== 'number' || form.data.scoring.firstBloodBonus < 0) {
          alert('First Blood Bonus must be a non-negative number');
          return false;
        }
        
        // totalVulnerabilities 자동 설정
        form.data.totalVulnerabilities = form.data.vulnerabilities.length;
        
        break;

      case 'FORENSICS_RUSH':
        if (!form.data.scenario?.title?.trim()) {
          alert('Scenario title is required');
          return false;
        }
        if ((form.data.questions?.length || 0) === 0) {
          alert('At least one question is required');
          return false;
        }
        break;

      case 'SOCIAL_ENGINEERING_CHALLENGE':
        if (!form.data.objective?.title?.trim()) {
          alert('Objective title is required');
          return false;
        }
        if (!form.data.aiTarget?.name?.trim()) {
          alert('AI target name is required');
          return false;
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

    // VulnerabilityScannerRace SIMULATED 모드일 때 안내 메시지
    const isVulnScannerSimulated =
      form.mode === 'VULNERABILITY_SCANNER_RACE' &&
      (form.data as any)?.mode === 'SIMULATED';

    if (isVulnScannerSimulated && !editingId) {
      console.log('🤖 Generating vulnerable HTML with Claude AI...');
    }

    try {
      if (editingId) {
        await updateScenario(editingId, form);
        await loadScenarios();
        alert('Scenario updated successfully!');
      } else {
        const created = await createScenario(form);
        setScenarios(prev => [created.scenario, ...prev]);

        if (isVulnScannerSimulated) {
          alert('Scenario created successfully!\n\n✅ Vulnerable HTML has been generated with Claude AI and saved to the scenario.');
        } else {
          alert('Scenario created successfully!');
        }
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
      alert('Failed to toggle scenario status');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete scenario "${title}"?`)) return;
    try {
      await deleteScenario(id);
      setScenarios(prev => prev.filter(s => s._id !== id));
      alert('Scenario deleted!');
    } catch (err) {
      alert('Failed to delete scenario');
    }
  };

  const getModeIcon = (mode: string) => {
    const icons: Record<string, string> = {
      TERMINAL_HACKING_RACE: '',
      VULNERABILITY_SCANNER_RACE: '',
      FORENSICS_RUSH: '',
      SOCIAL_ENGINEERING_CHALLENGE: ''
    };
    return icons[mode] || '';
  };

  const getModeName = (mode: string) => {
    const names: Record<string, string> = {
      TERMINAL_HACKING_RACE: 'Terminal Race',
      VULNERABILITY_SCANNER_RACE: 'Vulnerability Scanner Race',
      FORENSICS_RUSH: 'Forensics Rush',
      SOCIAL_ENGINEERING_CHALLENGE: 'Social Engineering'
    };
    return names[mode] || mode;
  };

  const getStageCount = (scenario: Scenario) => {
    if (!scenario || !scenario.data) return '-';

    switch (scenario.mode) {
      case 'TERMINAL_HACKING_RACE':
        return `${scenario.data.stages?.length || 0} stages`;
      case 'VULNERABILITY_SCANNER_RACE':
        return `${scenario.data.vulnerabilities?.length || 0} vulnerabilities`;
      case 'FORENSICS_RUSH':
        return `${scenario.data.questions?.length || 0} questions`;
      case 'SOCIAL_ENGINEERING_CHALLENGE':
        return `${scenario.data.availableTechniques?.length || 0} techniques`;
      default:
        return '-';
    }
  };

  return (
    <div className="admin-layout scenarios-management">
      <Sidebar />
      <div className="admin-content">
        <h1 className="page-title">Scenarios Management</h1>

        {error && <ErrorMessage message={error} />}

        {/* 폼 섹션 */}
        <div className="form-card">
          <h2>{editingId ? 'Edit Scenario' : 'Create New Scenario'}</h2>
          
          <form onSubmit={onSubmit}>
            <div className="basic-info">
              <div className="form-row-3">
                <div className="form-group">
                  <label>Game Mode *</label>
                  <select
                    value={form.mode}
                    onChange={e => handleModeChange(e.target.value)}
                    disabled={!!editingId}
                    required
                  >
                    <option value="TERMINAL_HACKING_RACE">Terminal Hacking Race</option>
                    <option value="VULNERABILITY_SCANNER_RACE">Vulnerability Scanner Race</option>
                    <option value="FORENSICS_RUSH">Forensics Rush</option>
                    <option value="SOCIAL_ENGINEERING_CHALLENGE">Social Engineering</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Difficulty *</label>
                  <select
                    value={form.difficulty}
                    onChange={e => {
                      const newDifficulty = e.target.value;
                      setForm(f => {
                        // VULNERABILITY_SCANNER_RACE: 난이도에 따라 mode 자동 설정
                        if (f.mode === 'VULNERABILITY_SCANNER_RACE') {
                          const isEasyOrMedium = newDifficulty === 'EASY' || newDifficulty === 'MEDIUM';
                          return {
                            ...f,
                            difficulty: newDifficulty,
                            data: {
                              ...f.data,
                              mode: isEasyOrMedium ? 'SIMULATED' : 'REAL',
                              targetUrl: isEasyOrMedium ? '' : f.data.targetUrl // EASY/MEDIUM이면 URL 초기화
                            }
                          };
                        }
                        return { ...f, difficulty: newDifficulty };
                      });
                    }}
                    required
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                    <option value="EXPERT">Expert</option>
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

              {form.mode === 'FORENSICS_RUSH' && (
                <ForensicsRushForm
                  data={form.data}
                  onChange={(data) => setForm(f => ({ ...f, data }))}
                />
              )}

              {form.mode === 'VULNERABILITY_SCANNER_RACE' && (
                <VulnerabilityScannerRaceForm
                  data={form.data}
                  onChange={(data) => setForm(f => ({ ...f, data }))}
                  difficulty={form.difficulty}
                />
              )}

              {form.mode === 'SOCIAL_ENGINEERING_CHALLENGE' && (
                <SocialEngineeringForm
                  data={form.data}
                  onChange={(data) => setForm(f => ({ ...f, data }))}
                />
              )}
            </div>

            <div className="form-actions">
              <button type="submit" disabled={saving}>
                {saving
                  ? form.mode === 'VULNERABILITY_SCANNER_RACE' && (form.data as any)?.mode === 'SIMULATED'
                    ? 'Generating HTML with AI...'
                    : 'Saving...'
                  : (editingId ? 'Update' : 'Create')}
              </button>
              <button type="button" onClick={handleCancelEdit} disabled={saving}>
                {editingId ? 'Cancel' : 'Reset'}
              </button>
            </div>
          </form>
        </div>

        {/* 필터 */}
        <div className="filters-section">
          <select value={filterMode} onChange={e => setFilterMode(e.target.value)}>
            <option value="ALL">All Modes</option>
            <option value="TERMINAL_HACKING_RACE">Terminal Race</option>
            <option value="VULNERABILITY_SCANNER_RACE">Vulnerability Scanner Race</option>
            <option value="FORENSICS_RUSH">Forensics Rush</option>
            <option value="SOCIAL_ENGINEERING_CHALLENGE">Social Engineering</option>
          </select>

          <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
            <option value="ALL">All Difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
            <option value="EXPERT">Expert</option>
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
                        {s.isActive ? 'Active' : 'Inactive'}
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