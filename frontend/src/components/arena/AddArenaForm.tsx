// AddArenaForm.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createArena } from '../../api/axiosArena';
import '../../assets/scss/arena/AddArenaForm.scss';

const formSteps = [
  { id: 'name', label: 'ROOM NAME', placeholder: 'Enter Room Name', type: 'text' },
  { id: 'maxParticipants', label: 'MAX PARTICIPANTS', type: 'number', min: 2, max: 4 },
  { id: 'duration', label: 'DURATION', type: 'number', min: 10, max: 60, step: 5 },
  { id: 'category', label: 'MACHINE TYPE', type: 'select', options: ['Web', 'Network', 'Crypto', 'OS', 'Database', 'Cloud', 'AI', 'Random'] },
];

const AddArenaForm: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({ name: '', category: 'Web', maxParticipants: 2, duration: 10 });
  const [error, setError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
  };

  const handleNext = () => {
    if (step === 0 && formData.name.trim() === '') {
      setError('Arena callsign is required.');
      setTimeout(() => setError(''), 2000);
      return;
    }
    if (step < formSteps.length - 1) setStep(step + 1);
  };

  const handlePrev = () => step > 0 && setStep(step - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const arena = await createArena(formData);
      navigate(`/arena/${arena._id}`);
    } catch (err: any) {
      const msg = err?.msg || 'Failed to create arena';
      setError(msg);
    }
  };

  const currentStep = formSteps[step];
  const progress = ((step + 1) / formSteps.length) * 100;

  const inputProps = {
    id: currentStep.id,
    name: currentStep.id,
    value: formData[currentStep.id as keyof typeof formData],
    onChange: handleChange,
    placeholder: currentStep.placeholder,
    min: currentStep.min,
    max: currentStep.max,
    step: currentStep.step,
    autoFocus: true,
    autoComplete: 'off',
    autoCorrect: 'off',
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleNext(); }
  };

  return (
    <div className="terminal-form-container">
      <div className="terminal-module">
        <div className="step-indicator">&lt; STEP {step + 1}: {currentStep.label.toUpperCase()} &gt;</div>

        <div className="progress-bar-container">
          <div className="progress-label">SYSTEM READY</div>
          <div className="progress-bar-track">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="progress-percent">{Math.round(progress)}%</div>
        </div>

        <div className="create-title">CREATE ROOM</div>

        <div key={step} className="step-content">
          <div className="crt-label-line">
            <span className="crt-label-text">{currentStep.label}</span>
          </div>

          {currentStep.type === 'select' ? (
            <select {...inputProps as any}>
              {currentStep.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input type={currentStep.type} {...inputProps} />
          )}
        </div>

        {!!error && <p className="form-error">{error}</p>}

        <div className="navigation-controls">
          {step > 0 && <button onClick={handlePrev} className="nav-button prev">[ BACK ]</button>}
          {step < formSteps.length - 1 ? (
            <button onClick={handleNext} className="nav-button next">[ NEXT ]</button>
          ) : (
            <button onClick={handleSubmit} className="nav-button create">[ COMPLETE ]</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddArenaForm;