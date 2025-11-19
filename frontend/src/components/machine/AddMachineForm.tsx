import React, { useEffect, useRef, useState, useContext } from 'react';
import { createMachine } from '../../api/axiosMachine';
import { useNavigate } from 'react-router-dom';
import '../../assets/scss/machine/AddMachineForm.scss';
import { IoMdArrowRoundBack } from 'react-icons/io';
import RegisterCompleteMD from '../modal/RegisterCompleteMD';
import { AuthUserContext } from '../../contexts/AuthUserContext';

interface MachineFormData {
  name: string;
  category: string;
  amiId: string;
  flag: string;
  description?: string;
  exp?: number;
  hints: string[];
  hintCosts: number[];
  difficulty: {
    creatorLevel: string;
  };
  creatorSurvey: {
    estimatedTime: number;
    requiredSkills: string[];
    technicalComplexity: number;
  };
}

interface ValidationErrors {
  [key: string]: string;
}

const AddMachineForm: React.FC = () => {
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const authUserContext = useContext(AuthUserContext);

  if (!authUserContext) {
    throw new Error('AddMachineForm must be used within an AuthUserProvider');
  }

  const availableSkills = [
    'Web', 'Network', 'Crypto', 'Reversing',
    'Pwn', 'Forensics', 'Cloud', 'AI'
  ];

  const [formData, setFormData] = useState<MachineFormData>({
    name: '',
    category: '',
    amiId: '',
    flag: '',
    description: '',
    exp: 50,
    hints: [''],
    hintCosts: [1],
    difficulty: {
      creatorLevel: ''
    },
    creatorSurvey: {
      estimatedTime: 30,
      requiredSkills: [],
      technicalComplexity: 3
    }
  });

  const [error, setError] = useState<string | null>(null);
  const [registerComplete, setRegisterComplete] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const navigate = useNavigate();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'exp' ? Number(value) : value
    }));
  };

  const handleHintChange = (index: number, value: string) => {
    const updated = [...formData.hints];
    updated[index] = value;
    setFormData(prev => ({ ...prev, hints: updated }));
  };

  const handleHintCostChange = (index: number, value: number) => {
    const updated = [...formData.hintCosts];
    updated[index] = value;
    setFormData(prev => ({ ...prev, hintCosts: updated }));
  };

  const addHint = () => {
    setFormData(prev => ({
      ...prev,
      hints: [...prev.hints, ''],
      hintCosts: [...prev.hintCosts, 1]
    }));
  };

  const removeHint = (index: number) => {
    const newHints = [...formData.hints];
    const newCosts = [...formData.hintCosts];
    newHints.splice(index, 1);
    newCosts.splice(index, 1);
    setFormData(prev => ({ ...prev, hints: newHints, hintCosts: newCosts }));
  };

  const handleSkillToggle = (skill: string) => {
    setFormData(prev => {
      const skills = prev.creatorSurvey.requiredSkills;
      return {
        ...prev,
        creatorSurvey: {
          ...prev.creatorSurvey,
          requiredSkills: skills.includes(skill)
            ? skills.filter(s => s !== skill)
            : [...skills, skill]
        }
      };
    });
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.name || formData.name.length < 3)
      errors.name = 'Name must be at least 3 characters long';

    if (!formData.category)
      errors.category = 'Category is required';

    if (!formData.amiId || !/^ami-[0-9a-fA-F]{8,17}$/.test(formData.amiId))
      errors.amiId = 'Invalid AMI ID format';

    if (!formData.flag || formData.flag.length < 5)
      errors.flag = 'Flag must be at least 5 characters long';

    if (!formData.description || formData.description.length < 4)
      errors.description = 'Description must be at least 4 characters long';

    if (!formData.exp || formData.exp < 50)
      errors.exp = 'EXP must be at least 50';

    if (!formData.hints.length || formData.hints.some(h => !h.trim()))
      errors.hints = 'At least one hint is required';

    if (!formData.difficulty.creatorLevel)
      errors.difficulty = 'Please select difficulty level';

    if (!formData.creatorSurvey.estimatedTime)
      errors.estimatedTime = 'Estimated time required';

    if (!formData.creatorSurvey.technicalComplexity)
      errors.technicalComplexity = 'Select complexity';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await createMachine(formData);
      setRegisterComplete(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (descriptionRef.current) {
      descriptionRef.current.style.height = "auto";
      descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`;
    }
  }, [formData.description]);

  return (
    <form onSubmit={handleSubmit} className="add-machine-form">

      {/* 상단 헤더 */}
      <div className="back-button">
        <h2>Add New Machine</h2>
        <button
          className="IconButton"
          type="button"
          onClick={() => navigate(-1)}
        >
          <IoMdArrowRoundBack style={{ color: 'white', fontSize: "34px" }} />
        </button>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {/* === 전체 컨테이너 === */}
      <div className="create-container">

        {/* 🔵 왼쪽 입력 필드 전체 묶음 */}
        <div className="left-fields">

          <div className="name-container">
            <label htmlFor="name">Machine Name *</label>
            <input type="text" id="name" name="name" value={formData.name}
              onChange={handleChange} className={validationErrors.name ? 'error-input' : ''} />
            {validationErrors.name && <span className="field-error">{validationErrors.name}</span>}
          </div>

          <div className="category-container">
            <label htmlFor="category">Category *</label>
            <select id="category" name="category" value={formData.category}
              onChange={handleChange} className={validationErrors.category ? 'error-input' : ''}>
              <option value="">--Select--</option>
              <option value="Web">Web</option>
              <option value="Network">Network</option>
              <option value="Database">Database</option>
              <option value="Crypto">Crypto</option>
              <option value="Cloud">Cloud</option>
              <option value="AI">AI</option>
              <option value="OS">OS</option>
              <option value="Other">Other</option>
            </select>
            {validationErrors.category && <span className="field-error">{validationErrors.category}</span>}
          </div>

          <div className="amiId-container">
            <label htmlFor="amiId">AMI ID *</label>
            <input type="text" id="amiId" name="amiId" value={formData.amiId}
              onChange={handleChange} className={validationErrors.amiId ? 'error-input' : ''} />
            {validationErrors.amiId && <span className="field-error">{validationErrors.amiId}</span>}
          </div>

          <div className="flag-container">
            <label htmlFor="flag">Flag *</label>
            <input type="text" id="flag" name="flag" value={formData.flag}
              onChange={handleChange} className={validationErrors.flag ? 'error-input' : ''} />
            {validationErrors.flag && <span className="field-error">{validationErrors.flag}</span>}
          </div>

          <div className="Description-container">
            <label htmlFor="description">Description *</label>
            <textarea
              ref={descriptionRef}
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={validationErrors.description ? 'error-input' : ''}
            />
            {validationErrors.description && <span className="field-error">{validationErrors.description}</span>}
          </div>

          <div className="exp-container">
            <label htmlFor="exp">Reward (EXP) *</label>
            <input type="number" id="exp" name="exp" min={50}
              value={formData.exp} onChange={handleChange}
              className={validationErrors.exp ? 'error-input' : ''} />
            {validationErrors.exp && <span className="field-error">{validationErrors.exp}</span>}
          </div>

          <div className="hint-container">
            <label>Hints *</label>

            {formData.hints.map((hint, i) => (
              <div className="key-container" key={i}>
                <input
                  type="text"
                  value={hint}
                  onChange={e => handleHintChange(i, e.target.value)}
                  placeholder="Hint"
                />
                <input
                  type="number"
                  value={formData.hintCosts[i]}
                  min={1}
                  onChange={e => handleHintCostChange(i, Number(e.target.value))}
                />
                {formData.hints.length > 1 && (
                  <button type="button" className="remove-hint" onClick={() => removeHint(i)}>
                    Remove
                  </button>
                )}
              </div>
            ))}

            <button type="button" className="add-hint" onClick={addHint}>
              Add Hint
            </button>

            {validationErrors.hints && <span className="field-error">{validationErrors.hints}</span>}
          </div>

        </div>

        {/* 🔴 오른쪽 난이도 섹션 */}
        <div className="difficulty-survey-section">
          <h3>Difficulty Survey</h3>

          <div className="difficulty-container">
            <label htmlFor="difficulty">Difficulty *</label>
            <select
              id="difficulty"
              value={formData.difficulty.creatorLevel}
              onChange={e => setFormData(prev => ({
                ...prev,
                difficulty: { creatorLevel: e.target.value }
              }))}
              className={validationErrors.difficulty ? 'error-input' : ''}
            >
              <option value="">--Select--</option>
              <option value="very_easy">Very Easy</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="very_hard">Very Hard</option>
            </select>
            {validationErrors.difficulty && <span className="field-error">{validationErrors.difficulty}</span>}
          </div>

          <div className="estimated-time-container">
            <label htmlFor="estimatedTime">Estimated Time *</label>
            <input
              type="number"
              id="estimatedTime"
              min={1}
              value={formData.creatorSurvey.estimatedTime}
              onChange={e => setFormData(prev => ({
                ...prev,
                creatorSurvey: {
                  ...prev.creatorSurvey,
                  estimatedTime: Number(e.target.value)
                }
              }))}
              className={validationErrors.estimatedTime ? 'error-input' : ''}
            />
            {validationErrors.estimatedTime && <span className="field-error">{validationErrors.estimatedTime}</span>}
          </div>

          <div className="required-skills-container">
            <label>Required Skills</label>
            <div className="skills-checkbox-group">
              {availableSkills.map(skill => (
                <label key={skill}>
                  <input
                    type="checkbox"
                    checked={formData.creatorSurvey.requiredSkills.includes(skill)}
                    onChange={() => handleSkillToggle(skill)}
                  />
                  <span>{skill}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="technical-complexity-container">
            <label htmlFor="technicalComplexity">Complexity *</label>
            <select
              id="technicalComplexity"
              value={formData.creatorSurvey.technicalComplexity}
              onChange={e => setFormData(prev => ({
                ...prev,
                creatorSurvey: {
                  ...prev.creatorSurvey,
                  technicalComplexity: Number(e.target.value)
                }
              }))}
              className={validationErrors.technicalComplexity ? 'error-input' : ''}
            >
              <option value={1}>1 - Simple</option>
              <option value={2}>2</option>
              <option value={3}>3 - Medium</option>
              <option value={4}>4</option>
              <option value={5}>5 - Very Complex</option>
            </select>
            {validationErrors.technicalComplexity && (
              <span className="field-error">{validationErrors.technicalComplexity}</span>
            )}
          </div>

        </div>
      </div>

      {/* 등록 완료 모달 */}
      {registerComplete && (
        <RegisterCompleteMD
          onClose={() => {
            setRegisterComplete(false);
            navigate('/machine');
          }}
          mode="machine"
        />
      )}

    </form>
  );
};

export default AddMachineForm;