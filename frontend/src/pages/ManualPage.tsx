import React, { useState, useEffect } from 'react';
import { useTranslation} from 'react-i18next';
import Main from '../components/main/Main';
import '../assets/scss/etc/ManualPage.scss';
import { PiHandWaving } from "react-icons/pi";
import { TbBrandOpenvpn } from "react-icons/tb";
import { AiOutlineCloudServer } from "react-icons/ai";
import { IoIosPlay } from "react-icons/io";
import { HiArrowNarrowRight } from 'react-icons/hi';
import { MdOutlineRuleFolder } from "react-icons/md";
import { IoInvertMode } from "react-icons/io5";
import { PiRanking } from "react-icons/pi";
import { GrVirtualMachine } from "react-icons/gr";
import { GiCrossedSwords } from "react-icons/gi";
import { FaRegQuestionCircle } from 'react-icons/fa';
import { CiLock } from 'react-icons/ci';
import { LuFlag } from "react-icons/lu";
import LoadingIcon from '../components/public/LoadingIcon';
import logo_light from "../assets/img/icon/HTO LIGHT RECOLORED_crop_filled.png";
import '../assets/scss/play/DownloadVPNProfile.scss';
import '../assets/scss/play/StartInstanceButton.scss';
import '../assets/scss/play/GetHints.scss';
import '../assets/scss/play/SubmitFlagForm.scss';

const ManualPage: React.FC = () => {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [shownHints, setShownHints] = useState<string[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState(null);
  const [flagInput, setFlagInput] = useState('');
  const [flagResult, setFlagResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSpawned, setIsSpawned] = useState(false);
  const [flag, setFlag] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const correctFlag = 'HTO{correct_flag}';
  const { t, i18n } = useTranslation('manual', { keyPrefix: 'manualPage' });

  useEffect(() => {
    const container = document.querySelector('.manual-page-container') as HTMLElement;

    // body 스크롤도 함께 제어
    if (selectedStep !== null) {
      document.body.style.overflow = 'hidden';
      if (container) container.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (container) container.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = '';
      if (container) container.style.overflow = 'auto';
    };
  }, [selectedStep]);

  const handleChangeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const steps = [
    { icon: <PiHandWaving size={40} />, key: 0 },
    { icon: <MdOutlineRuleFolder size={40} />, key: 1 },
    { icon: <IoInvertMode size={40} />, key: 2 },
    { icon: <PiRanking size={40} />, key: 3 },
    { icon: <GrVirtualMachine size={40} />, key: 4 },
    { icon: <GiCrossedSwords size={40} />, key: 5 }
  ];

  const fakeHints = [
    { content: 'nmap을 사용하여 열린 포트를 스캔해보세요.' },
    { content: '서비스 버전을 식별하여 취약점을 찾아보세요.' },
    { content: '취약점에 맞는 익스플로잇을 찾아보세요.' },
  ];

  const remainingHints = fakeHints.length - hintsUsed;
  const hints = fakeHints.slice(0, hintsUsed);

  const fetchHint = () => {
    if (remainingHints <= 0) return;
    setLoading(true);

    setTimeout(() => {
      setHintsUsed(prev => prev + 1);
      setLoading(false);
    }, 500); // 애니메이션용 딜레이
  };

  const handleFakeSpawn = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setIsSpawned(true);
      setStep(2);
    }, 1500);
  };

  const handleNext = () => setStep(prev => prev + 1);

  const handleFakeSubmit = () => {
    setErrors([]);
    setMessage('');

    if (!flag.trim()) {
      setErrors(['Flag cannot be empty.']);
      return;
    }

    if (flag === correctFlag) {
      setMessage('🎉 Correct flag!');
    } else {
      setErrors(['❌ Incorrect flag. Try again.']);
    }
  };


  return (
    <Main>
      <div className="manual-page-container">
        <div className="language-toggle">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={i18n.language === 'en'}
              onChange={() => handleChangeLanguage(i18n.language === 'en' ? 'ko' : 'en')}
            />
            <span className="slider">
              {i18n.language === 'en' ? 'English' : '한국어'}
            </span>
          </label>
        </div>


        <h1 className="main-title">{t('mainTitle')}</h1>

        <div className="flow-container">
          {steps.map((step, index) => (
            <React.Fragment key={step.key}>
              <div
                className={`flow-box ${selectedStep === step.key ? 'active' : ''}`}
                onClick={() => {
                  const container = document.querySelector('.manual-page-container');
                  if (container) {
                    container.scrollTo({ top: 0, behavior: 'auto' });
                  }
                  setSelectedStep(step.key);
                }}
                {...(step.key === 0 ? { 'data-tooltip': t('stepCard.firstVisit') } : {})}
                {...(step.key === 1 ? { 'data-tooltip': t('stepCard.Rules') } : {})}
                {...(step.key === 2 ? { 'data-tooltip': t('stepCard.Modes') } : {})}
                {...(step.key === 3 ? { 'data-tooltip': t('stepCard.Ranking') } : {})}
                {...(step.key === 4 ? { 'data-tooltip': t('stepCard.Machines') } : {})}
                {...(step.key === 5 ? { 'data-tooltip': t('stepCard.Contests') } : {})}
              >
                {step.icon}
                <span className="step-label">{t(`steps.${step.key}.short`)}</span>
              </div>

              {index < steps.length - 1 && (
                <div className="flow-arrow">
                  <HiArrowNarrowRight size={24} color="#888" />
                </div>
              )}
            </React.Fragment>
          ))}

          <br />
          <div className="now-tutorial">
            {t('tryTutorial')}
          </div>
        </div>


        {selectedStep !== null && (
          <div className="step-detail-overlay" onClick={() => setSelectedStep(null)}>
            <div className="step-detail" onClick={e => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setSelectedStep(null)}>X</button>
              <h1>{t(`steps.${selectedStep}.title`)}</h1>

              {selectedStep === 0 && (
                <div className="logo-container">
                  <img id="tutorialImg" className="tutorial-page-img-dark" alt="" src={logo_light}></img> 
                </div>
              )}

              {/* description_list 우선 처리 */}
              {Array.isArray(t(`steps.${selectedStep}.descriptions`, { returnObjects: true })) ? (
                <ul>
                  {(t(`steps.${selectedStep}.descriptions`, { returnObjects: true }) as string[]).map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p>{t(`steps.${selectedStep}.description`)}</p>
              )}
            </div>
          </div>
        )}

        <div className='tutorial'>
          <h2>{t('tutorialTitle')}</h2>

          {/* Connect */}
          <div className={`step-card ${step >= 0 ? 'active' : ''}`}>
          <div className="download-container">
          <div className='text-button-container'>
            <div className="upper-text">
              <TbBrandOpenvpn color="white" size={40} />
              <h2><b>{t('connect.title')}</b></h2>
            </div>
            <h3>{t('connect.description')}</h3>
            <div className='download-btn'>
              <label className={`download-label ${step > 0 ? 'clicked' : ''}`}>
                <input
                  type="checkbox"
                  className="download-input"
                  onClick={handleNext}
                  disabled={step !== 0}
                  checked={step > 0}
                  readOnly
                />
                <span className="download-circle">
                  <svg className="download-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                      d="M12 19V5m0 14-4-4m4 4 4-4" />
                  </svg>
                </span>
                <p className="download-title">{t('connect.button')}</p>
                <p className="download-title">{t('connect.done')}</p>
              </label>
            </div>
          </div>
          </div>
          </div>

          {/* Spawn Machine */}
          <div className={`step-card ${step >= 1 ? 'active' : ''}`}>
            <div className="start-instance-button-container">
            <div className="upper-text">
              <AiOutlineCloudServer size={40} color="white" />
              <h2><b>{t('spawn.title')}</b></h2>
            </div>
            <p>{t('spawn.description')}</p>
            <div className={`start-instance-btn ${loading ? 'disabled' : ''}`}>
              <label className={`download-label ${isSpawned ? 'clicked' : ''}`}>
                <input
                  type="checkbox"
                  className="download-input"
                  onClick={handleFakeSpawn}
                  disabled={loading || step !== 1}
                  checked={isSpawned}
                  readOnly
                />
                <span className="download-circle">
                  {loading ? <span className="loading-spinner" /> : <IoIosPlay size={20} color="white" />}
                  <div className="download-square"></div>
                </span>
                 <p className="download-title">{loading ? t('spawn.loading') : t('spawn.button')}</p>
                 <p className="download-title">{loading ? t('spawn.wait') : t('spawn.done')}</p>
              </label>
            </div>
            </div>
          </div>

          {/* Hints */}
          <div className={`step-card ${step >= 2 ? 'active' : ''}`}>
            <div className="get-hints-container">
              <div className="upper-text">
                <FaRegQuestionCircle size={40} color="white" />
                {remainingHints > 0 ? <h2>Hints</h2> : <h2>No More Hints</h2>}
              </div>
              <div className="lower-text">
                {remainingHints > 0 ? (
                  <h3>If you need a hint, Press the button</h3>
                ) : (
                  <h3>You have used all the hints for this machine.</h3>
                )}
              </div>

              {loading && <LoadingIcon />}

              {!loading && !error && hintsUsed > 0 && (
                <div className="used-hints">
                  <ul className="hints-list">
                    {hints.map((hint, index) => (
                      <li
                        className="list hint-animate"
                        key={index}
                        style={{ animationDelay: `${index * 0.2}s` }}
                      >
                        {hint.content}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={fetchHint}
                disabled={loading || remainingHints === 0 || disabled || step < 2}
                className={`get-hints-button ${disabled || remainingHints === 0 || step < 2 ? 'disabled' : ''}`}
              >
                {loading ? (
                  <LoadingIcon />
                ) : disabled || remainingHints === 0 ? (
                  <CiLock size={40} color="#ccc" />
                ) : (
                  'Hint'
                )}
                {!disabled && remainingHints > 0 && step >= 2 && ` (${remainingHints})`}
              </button>
            </div>
          </div>

          {/* Submit Flag */}
           <div className={`step-card ${step >= 3 ? 'active' : ''}`}>
            <div className="submit-flag-form">
              <div className='upper-text'>
                <LuFlag size={40} color="white" />
                <h2>Submit Flag</h2>
              </div>

              {message && <p className="message">{message}</p>}

              {errors.length > 0 && (
                <div className="error-messages">
                  {errors.map((msg, index) => (
                    <p key={index} className="error-text">{msg}</p>
                  ))}
                </div>
              )}

              <div className="flag-form">
                <input
                  className={`flag-input ${disabled ? "disabled" : ""} ${errors.length ? "error shake-error" : ""}`}
                  id="flag"
                  type="text"
                  value={flag}
                  onChange={(e) => setFlag(e.target.value)}
                  placeholder="Enter flag here"
                  disabled={disabled}
                />
                <button
                  type="button"
                  className={`submit-flag-button ${disabled ? "disabled" : ""}`}
                  disabled={disabled}
                  onClick={handleFakeSubmit}
                >
                  {disabled ? <CiLock size={40} color="#ccc" /> : 'Submit Flag'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Main>
  );
};

export default ManualPage;
