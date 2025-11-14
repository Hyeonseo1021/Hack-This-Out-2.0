import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createArena } from '../../api/axiosArena';
import '../../assets/scss/arena/AddArenaForm.scss'; 

const modes = [
  { 
    id: 'TERMINAL_HACKING_RACE', 
    icon: '⚡', 
    title: 'Terminal Hacking Race', 
    desc: '터미널 명령어로 가장 빠르게 해킹!',
    players: '2-8명'
  },
  { 
    id: 'CYBER_DEFENSE_BATTLE', 
    icon: '⚔️', 
    title: 'Cyber Defense Battle', 
    desc: '1:1 공격 vs 방어 실시간 대결!',
    players: '2명 (1v1)'
  },
  { 
    id: 'KING_OF_THE_HILL', 
    icon: '👑', 
    title: 'King of the Hill', 
    desc: '서버를 점령하고 왕좌를 지켜라!',
    players: '2-8명'
  },
  { 
    id: 'FORENSICS_RUSH', 
    icon: '🔍', 
    title: 'Forensics Rush', 
    desc: '증거를 분석하고 범인을 찾아내라!',
    players: '2-8명'
  },
  { 
    id: 'SOCIAL_ENGINEERING_CHALLENGE', 
    icon: '💬', 
    title: 'Social Engineering', 
    desc: 'AI를 속여 정보를 빼내는 심리전!',
    players: '1-4명'
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
    difficulty: '',
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
    
    // 모드별 참가자 수 자동 설정
    if (mode === 'CYBER_DEFENSE_BATTLE') {
      setFormData(prev => ({ ...prev, maxParticipants: 2 }));
    } else if (mode === 'SOCIAL_ENGINEERING_CHALLENGE') {
      setFormData(prev => ({ ...prev, maxParticipants: Math.min(prev.maxParticipants, 4) }));
    }
  };

  const handleDifficultySelect = (difficulty: string) => {
    setFormData(prev => ({ ...prev, difficulty }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.mode || !formData.difficulty) {
      setError('System Error: All fields are required.');
      return;
    }

    // 모드별 참가자 수 검증
    if (formData.mode === 'CYBER_DEFENSE_BATTLE' && formData.maxParticipants !== 2) {
      setError('System Error: Defense Battle requires exactly 2 players (1v1).');
      return;
    }

    if (formData.mode === 'SOCIAL_ENGINEERING_CHALLENGE' && formData.maxParticipants > 4) {
      setError('System Error: Social Engineering supports 1-4 players only.');
      return;
    }

    try {
      setLoading(true);
      const res = await createArena(formData);
      console.log('✅ Arena created:', res);
      navigate(`/arena/${res.arena._id}`);
    } catch (err: any) {
      console.error('❌ Create arena error:', err);
      const msg = err?.response?.data?.message || 'Failed to create arena.';
      setError(`System Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // 선택된 모드의 참가자 수 제한 가져오기
  const getMaxParticipantsLimit = () => {
    if (formData.mode === 'CYBER_DEFENSE_BATTLE') return { min: 2, max: 2 };
    if (formData.mode === 'SOCIAL_ENGINEERING_CHALLENGE') return { min: 1, max: 4 };
    return { min: 2, max: 8 };
  };

  const participantsLimit = getMaxParticipantsLimit();

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
                  min={participantsLimit.min}
                  max={participantsLimit.max}
                  disabled={formData.mode === 'CYBER_DEFENSE_BATTLE'}
                />
                {formData.mode && (
                  <small className="input-hint">
                    {participantsLimit.min === participantsLimit.max 
                      ? `Fixed: ${participantsLimit.max} players`
                      : `Range: ${participantsLimit.min}-${participantsLimit.max} players`
                    }
                  </small>
                )}
              </div>
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
                    <div className="mode-players">{mode.players}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- 3. 난이도 선택 창 --- */}
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