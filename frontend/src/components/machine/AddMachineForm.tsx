import React, { useEffect, useRef, useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('machine');
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const authUserContext = useContext(AuthUserContext);
  if (!authUserContext) {
    throw new Error('AddMachineForm must be used within an AuthUserProvider');
  }
  const { currentUser: _currentUser } = authUserContext;
  const availableSkills = ['Web', 'Network', 'Crypto', 'Reversing', 'Pwn', 'Forensics', 'Cloud', 'AI'];

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
  const navigate = useNavigate();
  const [registerComplete, setRegisterComplete] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: name === 'exp' ? Number(value) : value,
    }));
  };

  const handleHintChange = (index: number, value: string) => {
    const newHints = [...formData.hints];
    newHints[index] = value;
    setFormData((prevData) => ({
      ...prevData,
      hints: newHints,
    }));
  };

  const handleHintCostChange = (index: number, value: number) => {
    const newHintCosts = [...formData.hintCosts];
    newHintCosts[index] = value;
    setFormData((prevData) => ({
      ...prevData,
      hintCosts: newHintCosts,
    }));
  };

  const addHint = () => {
    setFormData((prevData) => ({
      ...prevData,
      hints: [...prevData.hints, ''],
      hintCosts: [...prevData.hintCosts, 1],
    }));
  };

  const removeHint = (index: number) => {
    const newHints = [...formData.hints];
    const newHintCosts = [...formData.hintCosts];
    newHints.splice(index, 1);
    newHintCosts.splice(index, 1);
    setFormData((prevData) => ({
      ...prevData,
      hints: newHints,
      hintCosts: newHintCosts,
    }));
  };

  const handleSkillToggle = (skill: string) => {
    setFormData((prevData) => {
      const skills = prevData.creatorSurvey.requiredSkills;
      const newSkills = skills.includes(skill)
        ? skills.filter(s => s !== skill)
        : [...skills, skill];

      return {
        ...prevData,
        creatorSurvey: {
          ...prevData.creatorSurvey,
          requiredSkills: newSkills
        }
      };
    });
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.name || formData.name.length < 3) {
      errors.name = t('form.errors.nameLength');
    }
    if (!formData.category) {
      errors.category = t('form.errors.categoryRequired');
    }
    if (!formData.amiId || !/^ami-[0-9a-fA-F]{8,17}$/.test(formData.amiId)) {
      errors.amiId = t('form.errors.invalidAmiId');
    }
    if (!formData.flag || formData.flag.length < 5) {
      errors.flag = t('form.errors.flagLength');
    }
    if (!formData.description || formData.description.length < 4) {
      errors.description = t('form.errors.descriptionLength');
    }
    if (!formData.exp || formData.exp < 50) {
      errors.exp = t('form.errors.expMinimum');
    }
    if (!formData.hints.length || formData.hints.some(hint => !hint.trim())) {
      errors.hints = t('form.errors.hintsRequired');
    }
    if (!formData.difficulty.creatorLevel) {
      errors.difficulty = t('form.errors.difficultyRequired');
    }
    if (!formData.creatorSurvey.estimatedTime || formData.creatorSurvey.estimatedTime < 1) {
      errors.estimatedTime = t('form.errors.estimatedTimeRequired');
    }
    if (!formData.creatorSurvey.technicalComplexity) {
      errors.technicalComplexity = t('form.errors.complexityRequired');
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    if (!validateForm()) {
      setError(t('form.fixErrors'));
      return;
    }

    try {
      await createMachine(formData);
      setRegisterComplete(true);
    } catch (err: any) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const adjustTextareaHeight = () => {
    if (descriptionRef.current) {
      descriptionRef.current.style.height = 'auto';
      descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [formData.description]);

  return (
    <form onSubmit={handleSubmit} className='add-machine-form'>

      {/* 상단 헤더 */}
      <div className='back-button'>
        <button
          className="IconButton"
          type="button"
          onClick={() => navigate(-1)}
        >
          <IoMdArrowRoundBack />
        </button>
        <h2>{t('form.title')}</h2>
      </div>

      {error && (
        <div
          className='error-message'
          style={{
            color: 'red',
            padding: '10px',
            marginBottom: '20px',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            borderRadius: '4px'
          }}
        >
          {error}
        </div>
      )}

      <div className='create-container'>

        {/* 난이도 섹션 */}
        <div className='difficulty-survey-section'>
          <h3>{t('form.difficultySurvey')}</h3>

          <div className='difficulty-container'>
            <label htmlFor='difficulty'>
              {t('form.expectedDifficulty')} <span style={{ color: 'red' }}>*</span>
            </label>
            <select
              id='difficulty'
              value={formData.difficulty.creatorLevel}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  difficulty: { creatorLevel: e.target.value }
                }))
              }
              className={validationErrors.difficulty ? 'error-input' : ''}
            >
              <option value="">{t('form.selectDifficulty')}</option>
              <option value="very_easy">⭐ {t('form.veryEasy')}</option>
              <option value="easy">⭐⭐ {t('form.easy')}</option>
              <option value="medium">⭐⭐⭐ {t('form.medium')}</option>
              <option value="hard">⭐⭐⭐⭐ {t('form.hard')}</option>
              <option value="very_hard">⭐⭐⭐⭐⭐ {t('form.veryHard')}</option>
            </select>
            {validationErrors.difficulty && (
              <span className='field-error'>{validationErrors.difficulty}</span>
            )}
          </div>

          <div className='estimated-time-container'>
            <label htmlFor='estimatedTime'>
              {t('form.estimatedTime')}{' '}
              <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type='number'
              id='estimatedTime'
              value={formData.creatorSurvey.estimatedTime}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  creatorSurvey: {
                    ...prev.creatorSurvey,
                    estimatedTime: Number(e.target.value)
                  }
                }))
              }
              min={1}
              placeholder='30'
              className={validationErrors.estimatedTime ? 'error-input' : ''}
            />
            {validationErrors.estimatedTime && (
              <span className='field-error'>{validationErrors.estimatedTime}</span>
            )}
          </div>

          <div className='required-skills-container'>
            <label>{t('form.requiredSkills')}</label>
            <div className='skills-checkbox-group'>
              {availableSkills.map((skill) => (
                <label
                  key={skill}
                  className={
                    formData.creatorSurvey.requiredSkills.includes(skill)
                      ? 'skill-selected'
                      : ''
                  }
                >
                  <input
                    type='checkbox'
                    checked={formData.creatorSurvey.requiredSkills.includes(
                      skill
                    )}
                    onChange={() => handleSkillToggle(skill)}
                  />
                  <span>{skill}</span>
                </label>
              ))}
            </div>
          </div>

          <div className='technical-complexity-container'>
            <label htmlFor='technicalComplexity'>
              {t('form.technicalComplexity')} <span style={{ color: 'red' }}>*</span>
            </label>
            <select
              id='technicalComplexity'
              value={formData.creatorSurvey.technicalComplexity}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  creatorSurvey: {
                    ...prev.creatorSurvey,
                    technicalComplexity: Number(e.target.value)
                  }
                }))
              }
              className={validationErrors.technicalComplexity ? 'error-input' : ''}
            >
              <option value={1}>1 - {t('form.verySimple')}</option>
              <option value={2}>2 - {t('form.simple')}</option>
              <option value={3}>3 - {t('form.moderate')}</option>
              <option value={4}>4 - {t('form.complex')}</option>
              <option value={5}>5 - {t('form.veryComplex')}</option>
            </select>
            {validationErrors.technicalComplexity && (
              <span className='field-error'>
                {validationErrors.technicalComplexity}
              </span>
            )}
          </div>
        </div>

        <div className='name-container'>
          <label htmlFor='name'>
            {t('form.machineName')} <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type='text'
            id='name'
            name='name'
            value={formData.name}
            onChange={handleChange}
            placeholder={t('form.enterMachineName')}
            className={validationErrors.name ? 'error-input' : ''}
          />
          {validationErrors.name && (
            <span className='field-error'>{validationErrors.name}</span>
          )}
        </div>

        <div className='category-container'>
          <label htmlFor='category'>
            {t('form.category')} <span style={{ color: 'red' }}>*</span>
          </label>
          <select
            id='category'
            name='category'
            value={formData.category}
            onChange={(e) => handleChange(e as any)}
            className={validationErrors.category ? 'error-input' : ''}
          >
            <option value="">{t('form.selectCategory')}</option>
            <option value="Web">Web</option>
            <option value="Network">Network</option>
            <option value="Database">Database</option>
            <option value="Crypto">Crypto</option>
            <option value="Cloud">Cloud</option>
            <option value="AI">AI</option>
            <option value="OS">OS</option>
            <option value="Other">Other</option>
          </select>
          {validationErrors.category && (
            <span className='field-error'>{validationErrors.category}</span>
          )}
        </div>

        <div className='amiId-container'>
          <label htmlFor='amiId'>
            {t('form.amiId')} <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type='text'
            id='amiId'
            name='amiId'
            value={formData.amiId}
            onChange={handleChange}
            placeholder='AMI-XXXXXX'
            className={validationErrors.amiId ? 'error-input' : ''}
          />
          {validationErrors.amiId && (
            <span className='field-error'>{validationErrors.amiId}</span>
          )}
        </div>

        <div className='flag-container'>
          <label htmlFor='flag'>
            {t('form.flag')} <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type='text'
            id='flag'
            name='flag'
            value={formData.flag}
            onChange={handleChange}
            placeholder={t('form.flagPlaceholder')}
            className={validationErrors.flag ? 'error-input' : ''}
          />
          {validationErrors.flag && (
            <span className='field-error'>{validationErrors.flag}</span>
          )}
        </div>

        <div className='Description-container'>
          <label htmlFor='description'>
            {t('form.description')} <span style={{ color: 'red' }}>*</span>
          </label>
          <textarea
            ref={descriptionRef}
            id='description'
            name='description'
            value={formData.description}
            placeholder={t('form.descriptionPlaceholder')}
            onChange={handleChange}
            className={validationErrors.description ? 'error-input' : ''}
          />
          {validationErrors.description && (
            <span className='field-error'>{validationErrors.description}</span>
          )}
        </div>

        <div className='exp-container'>
          <label htmlFor='exp'>
            {t('form.reward')} <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type='number'
            id='exp'
            name='exp'
            value={formData.exp}
            onChange={handleChange}
            min={50}
            className={validationErrors.exp ? 'error-input' : ''}
          />
          {validationErrors.exp && (
            <span className='field-error'>{validationErrors.exp}</span>
          )}
        </div>

        {/* ------------------------------ */}
        {/* 🔥 Back 버튼이 실제로 이동한 부분 */}
        {/* ------------------------------ */}
        <div className='hint-container'>
          <label>
            {t('form.hints')} <span style={{ color: 'red' }}>*</span>
          </label>

          {formData.hints.map((hint, index) => (
            <div className='key-container' key={index}>
              <input
                type='text'
                value={hint}
                onChange={(e) => handleHintChange(index, e.target.value)}
                placeholder={t('form.hint')}
              />
              <input
                type='number'
                value={formData.hintCosts[index]}
                onChange={(e) => handleHintCostChange(index, Number(e.target.value))}
                placeholder={t('form.cost')}
                min={1}
                max={100}
              />
              {formData.hints.length > 1 && (
                <button className='remove-hint' type='button' onClick={() => removeHint(index)}>
                  {t('form.remove')}
                </button>
              )}
            </div>
          ))}

          {validationErrors.hints && (
            <span className='field-error'>{validationErrors.hints}</span>
          )}

          <button className='add-hint' type='button' onClick={addHint}>
            {t('form.addHint')}
          </button>

          {/* 🔥 여기! Back 버튼이 정확히 들어감 */}
          <button
            className="IconButton"
            type="button"
            onClick={() => navigate(-1)}
            style={{ marginTop: '16px' }} // 위치 보조
          >
            <IoMdArrowRoundBack style={{ color: 'white', fontSize: "34px" }} />
          </button>
        </div>

        <div className='add-machine-form-button'>
          <button type='submit'>{t('form.submit')}</button>
        </div>
      </div>

      {registerComplete && (
        <RegisterCompleteMD
          onClose={() => {
            setRegisterComplete(false);
            navigate('/machine');
          }}
          mode='machine'
        />
      )}
    </form>
  );
};

export default AddMachineForm;
