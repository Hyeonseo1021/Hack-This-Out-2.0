import React, { useState } from 'react';
import { useTranslation} from 'react-i18next';
import Main from '../components/main/Main';
import '../assets/scss/etc/ManualPage.scss';
import { FaCheck } from "react-icons/fa";
import { TbBrandOpenvpn } from "react-icons/tb";
import { AiOutlineCloudServer } from "react-icons/ai";
import { IoIosPlay } from "react-icons/io";
import '../assets/scss/play/DownloadVPNProfile.scss';
import '../assets/scss/play/StartInstanceButton.scss';

const ManualPage: React.FC = () => {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [flagInput, setFlagInput] = useState('');
  const [flagResult, setFlagResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSpawned, setIsSpawned] = useState(false);
  const { t, i18n } = useTranslation('manual', { keyPrefix: 'manualPage' });

  const handleChangeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
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
  const handleShowHint = () => {
    setHintShown(true);
    handleNext();
  };

  const handleSubmitFlag = () => {
    if (flagInput === 'HTO{correct_flag}') {
      setFlagResult(t('flag.correct'));
    } else {
      setFlagResult(t('flag.incorrect'));
    }
  };

  const sidebarStepIndices = [0, 1, 2, 3]; // How to Play, LeaderBoard, Contests, Machines

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

        <section className="learning-outcomes">
          <h3>{t('learning.title')}</h3>
          <ul>
            <li><FaCheck className="check-icon" /> {t('learning.item1')}</li>
            <li><FaCheck className="check-icon" /> {t('learning.item2')}</li>
            <li><FaCheck className="check-icon" /> {t('learning.item3')}</li>
            <li><FaCheck className="check-icon" /> {t('learning.item4')}</li>
          </ul>
        </section>

        <section className="description">
          <p>{t('description')}</p>
        </section>

        <div className="flow-container">
          {sidebarStepIndices.map((index) => (
            <div
              key={index}
              className={`flow-box ${selectedStep === index ? 'active' : ''}`}
              onClick={() => setSelectedStep(index)}
            >
              {t(`steps.${index}.title`)}
            </div>
          ))}
        </div>

        {selectedStep !== null && (
          <div className="step-detail-overlay" onClick={() => setSelectedStep(null)}>
            <div className="step-detail" onClick={e => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setSelectedStep(null)}>X</button>
              <h1>{t(`steps.${selectedStep}.title`)}</h1>
              <p>{t(`steps.${selectedStep}.description`)}</p>
            </div>
          </div>
        )}

        <br />
        {t('tryTutorial')}

        <div className='tutorial'>
          <h2>{t('tutorialTitle')}</h2>

          {/* Connect */}
          <div className={`step-card ${step >= 0 ? 'active' : ''}`}>
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

          {/* Spawn Machine */}
          <div className={`step-card ${step >= 1 ? 'active' : ''}`}>
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

          {/* Hints */}
          <div className={`step-card ${step >= 2 ? 'active' : ''}`}>
            <h3>{t('hints.title')}</h3>
            <p>{t('hints.description')}</p>
            <button onClick={handleShowHint} disabled={step !== 2 || hintShown}>
              {t('hints.button')}
            </button>
            {hintShown && <p className="hint-text">💡 {t('hints.hintText')}</p>}
          </div>

          {/* Submit Flag */}
          <div className={`step-card ${step >= 3 ? 'active' : ''}`}>
            <h3>{t('flag.title')}</h3>
            <input
              type="text"
              placeholder={t('flag.placeholder')}
              value={flagInput}
              onChange={(e) => setFlagInput(e.target.value)}
              disabled={step !== 3}
            />
            <button onClick={handleSubmitFlag} disabled={step !== 3}>
              {t('flag.button')}
            </button>
            {flagResult && <p>{flagResult}</p>}
          </div>
        </div>
      </div>
    </Main>
  );
};

export default ManualPage;
