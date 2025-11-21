import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createArena } from '../../api/axiosArena';
import '../../assets/scss/arena/AddArenaForm.scss'; 

const modes = [
  {
    id: 'TERMINAL_HACKING_RACE',
    title: 'Terminal Race',
    desc: '터미널 명령어로 가장 빠르게 해킹',
    players: '2-8명'
  },
  {
    id: 'VULNERABILITY_SCANNER_RACE',
    title: 'Vulnerability Scanner Race',
    desc: '웹 애플리케이션의 취약점을 찾아내라',
    players: '2명'
  },
  {
    id: 'FORENSICS_RUSH',
    title: 'Forensics Rush',
    desc: '증거를 분석하고 범인을 찾아내라',
    players: '2-8명'
  },
  {
    id: 'SOCIAL_ENGINEERING_CHALLENGE',
    title: 'Social Engineering',
    desc: 'AI를 속여 정보를 빼내는 심리전',
    players: '1-4명'
  },
];

const difficulties = [
  { id: 'EASY', title: 'Easy' },
  { id: 'MEDIUM', title: 'Medium'},
  { id: 'HARD', title: 'Hard' },
  { id: 'EXPERT', title: 'Expert'},
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
    if (mode === 'VULNERABILITY_SCANNER_RACE') {  // ✅ 추가
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

    // ✅ Vulnerability Scanner Race 검증 추가
    if (formData.mode === 'VULNERABILITY_SCANNER_RACE' && formData.maxParticipants !== 2) {
      setError('System Error: Vulnerability Scanner Race requires exactly 2 players.');
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
    if (formData.mode === 'VULNERABILITY_SCANNER_RACE') {  // ✅ 추가
      return { min: 2, max: 2 };
    }
    if (formData.mode === 'SOCIAL_ENGINEERING_CHALLENGE') {
      return { min: 1, max: 4 };
    }
    return { min: 2, max: 8 };
  };

  const participantsLimit = getMaxParticipantsLimit();

  return (
    <div className="arena-create-container">
      <h1>Create Arena</h1>

      <form className="arena-grid-layout" onSubmit={handleSubmit}>

        {/* --- 1. 메인 컨트롤 창 --- */}
        <div className="card main-controls">
          <h2 className="card-title">Arena Settings</h2>
          <div className="card-content">
            <div className="form-group">
              <label>Room Name</label>
              <input
                type="text"
                name="name"
                placeholder="Enter room name..."
                value={formData.name}
                onChange={handleChange}
                maxLength={30}
              />
            </div>

            <div className="form-group">
              <label>Max Participants</label>
              <input
                type="number"
                name="maxParticipants"
                value={formData.maxParticipants}
                onChange={handleChange}
                min={participantsLimit.min}
                max={participantsLimit.max}
                disabled={
                  formData.mode === 'VULNERABILITY_SCANNER_RACE'
                }
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

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="submit-button" disabled={loading}>
              <span>{loading ? 'Creating...' : 'Create Arena'}</span>
            </button>
          </div>
        </div>

        {/* --- 2. 모드 선택 창 --- */}
        <div className="card mode-selector">
          <h2 className="card-title">Select Game Mode</h2>
          <div className="card-content">
            <div className="mode-list">
              {modes.map(mode => (
                <div
                  key={mode.id}
                  className={`mode-card ${formData.mode === mode.id ? 'selected' : ''}`}
                  onClick={() => handleModeSelect(mode.id)}
                >
                  <h3 className="mode-title">{mode.title}</h3>
                  <p className="mode-desc">{mode.desc}</p>
                  <span className="mode-players">{mode.players}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- 3. 난이도 선택 창 --- */}
        <div className="card difficulty-selector">
          <h2 className="card-title">Select Difficulty</h2>
          <div className="card-content">
            <div className="difficulty-grid">
              {difficulties.map(diff => (
                <button
                  key={diff.id}
                  type="button"
                  className={`difficulty-btn ${formData.difficulty === diff.id ? 'selected' : ''}`}
                  onClick={() => handleDifficultySelect(diff.id)}
                >
                  <span>{diff.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </form>
    </div>
  );
};

export default AddArenaForm;