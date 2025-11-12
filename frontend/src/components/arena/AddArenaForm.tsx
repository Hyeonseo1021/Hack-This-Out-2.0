import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createArena } from '../../api/axiosArena';
import '../../assets/scss/arena/AddArenaForm.scss'; 

const modes = [
  { 
    id: 'TERMINAL_HACKING_RACE', 
    icon: '⚡', 
    title: 'Terminal Hacking Race', 
    desc: '터미널 명령어로 가장 빠르게 해킹!' 
  },
  { 
    id: 'CYBER_DEFENSE_BATTLE', 
    icon: '⚔️', 
    title: 'Cyber Defense Battle', 
    desc: '2팀으로 나뉘어 실시간 공방전!' 
  },
  { 
    id: 'CAPTURE_THE_SERVER', 
    icon: '🏰', 
    title: 'Capture The Server', 
    desc: '서버를 점령해 영토를 확장하세요.' 
  },
  { 
    id: 'HACKERS_DECK', 
    icon: '🎲', 
    title: "Hacker's Deck", 
    desc: '해킹 카드를 활용한 턴제 전략 대결!' 
  },
  { 
    id: 'EXPLOIT_CHAIN_CHALLENGE', 
    icon: '🎯', 
    title: 'Exploit Chain Challenge', 
    desc: '단계별 취약점 퍼즐을 해결하세요.' 
  },
];

const difficulties = [
  { id: 'EASY', icon: '🟢', title: 'Easy' },
  { id: 'MEDIUM', icon: '🟡', title: 'Medium'},
  { id: 'HARD', icon: '🔴', title: 'Hard' },
  { id: 'EXPERT', icon: '💀', title: 'Expert'},
];

const AddArenaForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    mode: '',
    difficulty: '',  // ✅ 추가
    maxParticipants: 2,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
  };

  const handleModeSelect = (mode: string) => {
    setFormData(prev => ({ ...prev, mode }));
  };

  // ✅ 난이도 선택 핸들러 추가
  const handleDifficultySelect = (difficulty: string) => {
    setFormData(prev => ({ ...prev, difficulty }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // ✅ 난이도 검증 추가
    if (!formData.name.trim() || !formData.mode || !formData.difficulty) {
      setError('System Error: All fields are required.');
      return;
    }

    try {
      setLoading(true);
      const res = await createArena(formData);
      console.log('✅ Arena created:', res);
      navigate(`/arena/${res.arena._id}`);  // ✅ res.arena._id로 수정 (서버에서 { arena, scenario } 반환)
    } catch (err: any) {
      console.error('❌ Create arena error:', err);
      const msg = err?.response?.data?.message || 'Failed to create arena.';
      setError(`System Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="arena-create-container">
      <div className="crt-overlay"></div>
      <h1 className="glitch-title" data-text="CREATE ARENA">CREATE ARENA</h1>

      <form className="arena-grid-layout" onSubmit={handleSubmit}>
        
        {/* --- 1. 메인 컨트롤 창 --- */}
        <div className="widget-window main-controls">
          <div className="widget-titlebar">MAIN_CONTROL</div>
          <div className="widget-content">
            <div className="form-group">
              <label>ROOM NAME</label>
              <input
                type="text"
                name="name"
                placeholder="Enter room name..."
                value={formData.name}
                onChange={handleChange}
                maxLength={30}
              />
            </div>
            
            <div className="form-inline">
              <div className="form-group small">
                <label>MAX PARTICIPANTS</label>
                <input
                  type="number"
                  name="maxParticipants"
                  value={formData.maxParticipants}
                  onChange={handleChange}
                  min={2}
                  max={8}
                />
              </div>

              {/* ✅ duration 제거됨 - 시나리오에서 자동으로 설정 */}
            </div>
          </div>
        </div>

        {/* --- 2. 모드 선택 창 --- */}
        <div className="widget-window mode-selector">
          <div className="widget-titlebar">MODE_SELECT</div>
          <div className="widget-content">
            <div className="mode-table-layout">
              {modes.map(mode => (
                <div
                  key={mode.id}
                  className={`mode-row ${formData.mode === mode.id ? 'selected' : ''}`}
                  onClick={() => handleModeSelect(mode.id)}
                >
                  <div className="mode-icon">{mode.icon}</div>
                  <div className="mode-info">
                    <div className="mode-title">{mode.title}</div>
                    <div className="mode-desc">{mode.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- 3. 난이도 선택 창 (새로 추가) --- */}
        <div className="widget-window difficulty-selector">
          <div className="widget-titlebar">DIFFICULTY_SELECT</div>
          <div className="widget-content">
            <div className="difficulty-grid">
              {difficulties.map(diff => (
                <div
                  key={diff.id}
                  className={`difficulty-card ${formData.difficulty === diff.id ? 'selected' : ''}`}
                  onClick={() => handleDifficultySelect(diff.id)}
                >
                  <div className="difficulty-icon">{diff.icon}</div>
                  <div className="difficulty-title">{diff.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- 4. 시스템 로그 창 --- */}
        <div className="widget-window system-log">
          <div className="widget-titlebar">SYSTEM_LOG</div>
          <div className="widget-content">
            <div className="log-area">
              {!error && !loading && !formData.mode && (
                <p className="log-entry info">System ready. Awaiting command...</p>
              )}
              {!error && !loading && formData.mode && !formData.difficulty && (
                <p className="log-entry info">Mode selected: {formData.mode}. Select difficulty...</p>
              )}
              {!error && !loading && formData.mode && formData.difficulty && (
                <p className="log-entry success">
                  Configuration complete: {formData.mode} - {formData.difficulty}
                </p>
              )}
              {loading && <p className="log-entry processing">Connecting to host... Creating arena...</p>}
              {error && <p className="log-entry error">{error}</p>}
            </div>
            <button type="submit" className="neon-button" disabled={loading}>
              {loading ? 'EXECUTING...' : 'EXECUTE'}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};

export default AddArenaForm;