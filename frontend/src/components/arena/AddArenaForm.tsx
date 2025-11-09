import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createArena } from '../../api/axiosArena';
import '../../assets/scss/arena/AddArenaForm.scss'; 

const modes = [
  { id: 'Terminal Race', icon: '⚡', title: 'Terminal Race', desc: '터미널 명령어로 가장 빠르게 해킹!' },
  { id: 'Defense Battle', icon: '⚔️', title: 'Defense Battle', desc: '2팀으로 나뉘어 실시간 공방전!' },
  { id: 'Capture Server', icon: '🏰', title: 'Capture Server', desc: '서버를 점령해 영토를 확장하세요.' },
  { id: "Hacker's Deck", icon: '🎲', title: "Hacker's Deck", desc: '해킹 카드를 활용한 턴제 전략 대결!' },
  { id: 'Exploit Chain', icon: '🎯', title: 'Exploit Chain', desc: '단계별 취약점 퍼즐을 해결하세요.' },
];

const AddArenaForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    mode: '',
    maxParticipants: 2,
    duration: 10,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.mode) {
      setError('System Error: All fields are required.');
      return;
    }

    try {
      setLoading(true);
      const res = await createArena(formData);
      navigate(`/arena/${res._id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.msg || 'Failed to create arena.';
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
          <div className="widget-titlebar">:: MAIN_CONTROL.EXE</div>
          <div className="widget-content">
            <div className="form-group">
              <label>ROOM NAME</label>
              <input
                type="text"
                name="name"
                placeholder="Enter room name..."
                value={formData.name}
                onChange={handleChange}
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

              <div className="form-group small">
                <label>DURATION (MIN)</label>
                <input
                  type="number"
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  min={5}
                  max={60}
                  step={5}
                />
              </div>
            </div>
          </div>
        </div>

        {/* --- 2. 모드 선택 창 (수정됨) --- */}
        <div className="widget-window mode-selector">
          <div className="widget-titlebar">:: MODE_SELECT.MOD</div>
          <div className="widget-content">
            {/* ⬇️ 'mode-grid' -> 'mode-table-layout'로 변경 ⬇️ */}
            <div className="mode-table-layout">
              {modes.map(mode => (
                // ⬇️ 'mode-card' -> 'mode-row'로 변경 및 내부 구조 수정 ⬇️
                <div
                  key={mode.id}
                  className={`mode-row ${formData.mode === mode.id ? 'selected' : ''}`}
                  onClick={() => handleModeSelect(mode.id)}
                >
                  <div className="mode-icon">{mode.icon}</div>
                  {/* ⬇️ 텍스트를 묶는 'mode-info' 그룹 추가 ⬇️ */}
                  <div className="mode-info">
                    <div className="mode-title">{mode.title}</div>
                    <div className="mode-desc">{mode.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- 3. 시스템 로그 창 --- */}
        <div className="widget-window system-log">
          <div className="widget-titlebar">:: SYSTEM_LOG.DAT</div>
          <div className="widget-content">
            <div className="log-area">
              {!error && !loading && <p className="log-entry info">System ready. Awaiting command...</p>}
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