// AddArenaForm.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createArena } from '../../api/axiosArena';
import { getActiveMachines } from '../../api/axiosMachine';
import '../../assets/scss/arena/AddArenaForm.scss';

interface Machine {
  _id: string;
  name: string;
  category: string;
  description: string;
  exp: number;
  isActive: boolean;
  difficulty?: {
    creatorLevel?: string;
    confirmedLevel?: string;
    isConfirmed?: boolean;
  };
}

const formSteps = [
  { id: 'name', label: 'ROOM NAME', placeholder: 'Enter Room Name', type: 'text' },
  { id: 'machineId', label: 'SELECT MACHINE', type: 'machine-select' },
  { id: 'maxParticipants', label: 'MAX PARTICIPANTS', type: 'number', min: 2, max: 4 },
  { id: 'duration', label: 'DURATION (MINUTES)', type: 'number', min: 10, max: 60, step: 5 },
];

const difficultyLabels: { [key: string]: string } = {
  'very_easy': '⭐',
  'easy': '⭐⭐',
  'medium': '⭐⭐⭐',
  'hard': '⭐⭐⭐⭐',
  'very_hard': '⭐⭐⭐⭐⭐'
};

const AddArenaForm: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({ 
    name: '', 
    machineId: '', 
    maxParticipants: 2, 
    duration: 30 
  });
  const [machines, setMachines] = useState<Machine[]>([]);
  const [filteredMachines, setFilteredMachines] = useState<Machine[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // 머신 목록 로드 - 모든 활성화된 머신
  useEffect(() => {
    const fetchMachines = async () => {
      try {
        setLoading(true);
        const response = await getActiveMachines();
        // response.machines가 배열
        const activeMachines = response.machines || [];
        setMachines(activeMachines);
        setFilteredMachines(activeMachines);
      } catch (err) {
        console.error('Failed to fetch machines:', err);
        setError('Failed to load machines');
      } finally {
        setLoading(false);
      }
    };

    fetchMachines();
  }, []);

  // 카테고리별 필터링
  useEffect(() => {
    if (selectedCategory === '') {
      setFilteredMachines(machines);
    } else {
      setFilteredMachines(machines.filter(machine => machine.category === selectedCategory));
    }
  }, [selectedCategory, machines]);

  const categories = [...new Set(machines.map(machine => machine.category))];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
  };

  const handleMachineSelect = (machineId: string) => {
    setFormData(prev => ({ ...prev, machineId }));
  };

  const handleNext = () => {
    // 각 단계별 유효성 검사
    if (step === 0 && formData.name.trim() === '') {
      setError('Arena name is required.');
      setTimeout(() => setError(''), 2000);
      return;
    }
    
    if (step === 1 && !formData.machineId) {
      setError('Please select a machine.');
      setTimeout(() => setError(''), 2000);
      return;
    }

    if (step < formSteps.length - 1) {
      setStep(step + 1);
      setError('');
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.machineId) {
      setError('Please select a machine.');
      return;
    }

    try {
      setLoading(true);
      const arena = await createArena(formData);
      navigate(`/arena/${arena._id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.msg || 'Failed to create arena';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const currentStep = formSteps[step];
  const progress = ((step + 1) / formSteps.length) * 100;
  const selectedMachine = machines.find(m => m._id === formData.machineId);

  const getDifficultyDisplay = (machine: Machine) => {
    const level = machine.difficulty?.confirmedLevel || machine.difficulty?.creatorLevel;
    if (!level) return '';
    return difficultyLabels[level] || '';
  };

  const inputProps = {
    id: currentStep.id,
    name: currentStep.id,
    value: formData[currentStep.id as keyof typeof formData],
    onChange: handleChange,
    placeholder: currentStep.placeholder,
    min: currentStep.min,
    max: currentStep.max,
    step: currentStep.step,
    autoFocus: currentStep.type !== 'machine-select',
    autoComplete: 'off',
    autoCorrect: 'off',
    onKeyDown: (e: React.KeyboardEvent) => { 
      if (e.key === 'Enter' && currentStep.type !== 'machine-select') handleNext(); 
    }
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

        <div className="create-title">CREATE ARENA</div>

        <div key={step} className="step-content">
          <div className="crt-label-line">
            <span className="crt-label-text">{currentStep.label}</span>
            {selectedMachine && step === 1 && (
              <span className="selected-info">
                [{selectedMachine.category}] {selectedMachine.name}
              </span>
            )}
          </div>

          {currentStep.type === 'machine-select' ? (
            <div className="machine-selection" style={{
              width: '100%',
              marginTop: '20px'
            }}>
              {loading ? (
                <div className="loading-message">Loading machines...</div>
              ) : (
                <>
                  {/* 카테고리 필터 */}
                  <div className="category-filter">
                    <select 
                      value={selectedCategory} 
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="category-select"
                    >
                      <option value="">ALL CATEGORIES</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  {/* 머신 목록 */}
                  <div className="machine-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '15px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    padding: '10px 0'
                  }}>
                    {filteredMachines.length === 0 ? (
                      <div className="no-machines">
                        {machines.length === 0 
                          ? 'No machines available.' 
                          : 'No machines available for this category.'}
                      </div>
                    ) : (
                      filteredMachines.map(machine => (
                        <div 
                          key={machine._id} 
                          className={`machine-card ${formData.machineId === machine._id ? 'selected' : ''}`}
                          onClick={() => handleMachineSelect(machine._id)}
                          style={{
                            background: formData.machineId === machine._id ? 'rgba(0, 255, 0, 0.1)' : '#000',
                            border: formData.machineId === machine._id ? '2px solid #00ff00' : '2px solid #333',
                            padding: '15px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            fontFamily: 'Courier New, monospace',
                            fontSize: '12px'
                          }}
                        >
                          <div className="machine-header" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '10px'
                          }}>
                            <div className="machine-name" style={{
                              color: formData.machineId === machine._id ? '#00ff00' : '#fff',
                              fontWeight: 'bold',
                              fontSize: '14px',
                              flex: 1,
                              marginRight: '10px'
                            }}>{machine.name}</div>
                            <div className="machine-category" style={{
                              color: '#ff6600',
                              fontSize: '11px',
                              whiteSpace: 'nowrap'
                            }}>[{machine.category}]</div>
                          </div>
                          
                          {/* 난이도 표시 */}
                          {getDifficultyDisplay(machine) && (
                            <div className="machine-difficulty" style={{
                              color: '#ffcc00',
                              fontSize: '11px',
                              marginBottom: '8px'
                            }}>
                              Difficulty: {getDifficultyDisplay(machine)}
                            </div>
                          )}

                          <div className="machine-description" style={{
                            color: '#ccc',
                            lineHeight: '1.4',
                            marginBottom: '12px',
                            minHeight: '40px',
                            fontSize: '11px'
                          }}>
                            {machine.description || 'No description available'}
                          </div>
                          <div className="machine-exp" style={{
                            color: '#00aa00',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            textAlign: 'right'
                          }}>
                            REWARD: {machine.exp} EXP
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <input type={currentStep.type} {...inputProps} />
          )}
        </div>

        {!!error && <p className="form-error">{error}</p>}

        <div className="navigation-controls">
          {step > 0 && (
            <button 
              onClick={handlePrev} 
              className="nav-button prev"
              disabled={loading}
            >
              [ BACK ]
            </button>
          )}
          
          {step < formSteps.length - 1 ? (
            <button 
              onClick={handleNext} 
              className="nav-button next"
              disabled={loading}
            >
              [ NEXT ]
            </button>
          ) : (
            <button 
              onClick={handleSubmit} 
              className="nav-button create"
              disabled={loading || !formData.machineId}
            >
              {loading ? '[ CREATING... ]' : '[ COMPLETE ]'}
            </button>
          )}
        </div>

        {/* 선택된 머신 정보 요약 (마지막 단계에서) */}
        {step === formSteps.length - 1 && selectedMachine && (
          <div className="selected-machine-summary">
            <div className="summary-title">SELECTED MACHINE:</div>
            <div className="summary-info">
              <span className="summary-name">{selectedMachine.name}</span>
              <span className="summary-category">[{selectedMachine.category}]</span>
              {getDifficultyDisplay(selectedMachine) && (
                <span className="summary-difficulty">{getDifficultyDisplay(selectedMachine)}</span>
              )}
              <span className="summary-exp">{selectedMachine.exp} EXP</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddArenaForm;