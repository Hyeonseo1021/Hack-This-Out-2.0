import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createArena } from '../../api/axiosArena';
import '../../assets/scss/arena/AddArenaForm.scss';

const AddArenaForm: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('arena');
  const [formData, setFormData] = useState({
    name: '',
    mode: '',
    difficulty: '',
    maxParticipants: 2,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 모드 목록 (번역 사용)
  const modes = [
    {
      id: 'TERMINAL_HACKING_RACE',
      title: t('modes.TERMINAL_HACKING_RACE.title'),
      desc: t('modes.TERMINAL_HACKING_RACE.desc'),
      players: t('modes.TERMINAL_HACKING_RACE.players')
    },
    {
      id: 'VULNERABILITY_SCANNER_RACE',
      title: t('modes.VULNERABILITY_SCANNER_RACE.title'),
      desc: t('modes.VULNERABILITY_SCANNER_RACE.desc'),
      players: t('modes.VULNERABILITY_SCANNER_RACE.players')
    },
    {
      id: 'FORENSICS_RUSH',
      title: t('modes.FORENSICS_RUSH.title'),
      desc: t('modes.FORENSICS_RUSH.desc'),
      players: t('modes.FORENSICS_RUSH.players')
    },
    {
      id: 'SOCIAL_ENGINEERING',
      title: t('modes.SOCIAL_ENGINEERING.title') + ' (Coming Soon)',
      desc: t('modes.SOCIAL_ENGINEERING.desc'),
      players: t('modes.SOCIAL_ENGINEERING.players'),
      disabled: true  // Coming Soon
    },
  ];

  // 난이도 목록 (번역 사용)
  const difficulties = [
    { id: 'EASY', title: t('difficulties.EASY') },
    { id: 'MEDIUM', title: t('difficulties.MEDIUM') },
    { id: 'HARD', title: t('difficulties.HARD') },
    { id: 'EXPERT', title: t('difficulties.EXPERT') },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
  };

  const handleModeSelect = (mode: string) => {
    setFormData(prev => ({ ...prev, mode }));

    // 모드별 참가자 수 자동 설정
    if (mode === 'VULNERABILITY_SCANNER_RACE') {
      setFormData(prev => ({ ...prev, maxParticipants: 2 }));
    } else if (mode === 'SOCIAL_ENGINEERING') {
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
      setError(t('errors.allFieldsRequired'));
      return;
    }

    if (formData.mode === 'VULNERABILITY_SCANNER_RACE' && formData.maxParticipants !== 2) {
      setError(t('errors.vulnScannerOnly2'));
      return;
    }

    if (formData.mode === 'SOCIAL_ENGINEERING' && formData.maxParticipants > 4) {
      setError(t('errors.socialEngOnly4'));
      return;
    }

    try {
      setLoading(true);
      const res = await createArena(formData);
      console.log('✅ Arena created:', res);
      navigate(`/arena/${res.arena._id}`);
    } catch (err: any) {
      console.error('❌ Create arena error:', err);
      const msg = err?.response?.data?.message || t('errors.failedToCreate');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getMaxParticipantsLimit = () => {
    if (formData.mode === 'VULNERABILITY_SCANNER_RACE') {
      return { min: 2, max: 2 };
    }
    if (formData.mode === 'SOCIAL_ENGINEERING') {
      return { min: 1, max: 4 };
    }
    return { min: 2, max: 8 };
  };

  const participantsLimit = getMaxParticipantsLimit();

  return (
    <div className="arena-create-container">
      <h1>{t('createArena')}</h1>

      <form className="arena-grid-layout" onSubmit={handleSubmit}>

        {/* 왼쪽: 모든 설정 */}
        <div className="card settings-card">
          <h2 className="card-title">{t('arenaSettings')}</h2>
          <div className="card-content">
            <div className="form-group">
              <label>{t('arenaName')}</label>
              <input
                type="text"
                name="name"
                placeholder={t('enterRoomName')}
                value={formData.name}
                onChange={handleChange}
                maxLength={30}
              />
            </div>

            <div className="form-group">
              <label>{t('maxParticipants')}</label>
              <input
                type="number"
                name="maxParticipants"
                value={formData.maxParticipants}
                onChange={handleChange}
                min={participantsLimit.min}
                max={participantsLimit.max}
                disabled={formData.mode === 'VULNERABILITY_SCANNER_RACE'}
              />
              {formData.mode && (
                <small className="input-hint">
                  {participantsLimit.min === participantsLimit.max
                    ? t('fixedPlayers', { max: participantsLimit.max })
                    : t('rangePlayers', { min: participantsLimit.min, max: participantsLimit.max })
                  }
                </small>
              )}
            </div>

            <div className="form-group">
              <label>{t('difficulty')}</label>
              <div className="difficulty-buttons">
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

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="submit-button" disabled={loading}>
              <span>{loading ? t('creating') : t('createArena')}</span>
            </button>
          </div>
        </div>

        {/* 오른쪽: 게임 모드 */}
        <div className="card mode-selector">
          <h2 className="card-title">{t('selectGameMode')}</h2>
          <div className="card-content">
            <div className="mode-list">
              {modes.map(mode => (
                <div
                  key={mode.id}
                  className={`mode-card ${formData.mode === mode.id ? 'selected' : ''} ${(mode as any).disabled ? 'disabled' : ''}`}
                  onClick={() => !(mode as any).disabled && handleModeSelect(mode.id)}
                  style={(mode as any).disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  <h3 className="mode-title">{mode.title}</h3>
                  <p className="mode-desc">{mode.desc}</p>
                  <span className="mode-players">{mode.players}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddArenaForm;
