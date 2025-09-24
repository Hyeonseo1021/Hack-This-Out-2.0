import React, { useState } from 'react';
import '../assets/scss/etc/ManualPage.scss';
import Main from '../components/main/Main';
import { Link } from 'react-router-dom';
import Hackcat from "../assets/img/icon/Hack cat.png";
import { useTranslation } from 'react-i18next';

const ManualPage: React.FC = () => {
  const { t, i18n } = useTranslation('manual');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [currentDialog, setCurrentDialog] = useState(0);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ko' ? 'en' : 'ko';
    i18n.changeLanguage(newLang);
  };
  
  // rules 배열 안전 처리
  const rulesData = t('rules', { returnObjects: true });
  const rules = Array.isArray(rulesData) ? rulesData : [];

  // 페이지1 대화 데이터
  const dialogs = [
    { title: t('welcomeTitle'), message: t('welcomeMessage') },
    { title: t('guideTitle'), rules: rules },
  ];

  const handleNextDialog = () => {
    if (currentPage === 1) {
      if (currentDialog < dialogs.length - 1) {
        setCurrentDialog(currentDialog + 1);
      } else {
        setCurrentPage(2);
        setCurrentDialog(0);
      }
    }
  };

  const currentDialogData = dialogs[currentDialog];

  return (
    <Main>
      <div className="manual-beginner-viewport">
        <div className="manual-beginner-container">
          
          {/* --- 헤더 --- */}
          <div className="manual-header">
            <h1 className="manual-title" data-text={t('title')}>
              {t('title')}
            </h1>
            <button className="language-toggle" onClick={toggleLanguage}>
              {i18n.language === 'ko' ? 'EN' : 'KO'}
            </button>
          </div>
          
          {/* --- 아무 화면 클릭 시 다음으로 --- */}
          <div className="manual-content-area" onClick={handleNextDialog}>
            
            {/* --- 페이지 1 --- */}
            {currentPage === 1 && (
              <div className="page page-one active">
                <div className="dialog-wrapper">
                  <img src={Hackcat} alt="Guide Avatar" className="guide-avatar" />
                  {/* ✅ 흔들림/글리치 효과 클래스 추가 */}
                  <div className="speech-bubble glitch-bubble">
                    <h2 className="bubble-title">{currentDialogData.title}</h2>
                    {currentDialogData.message && <p>{currentDialogData.message}</p>}
                    {currentDialogData.rules && (
                      <ul className="rules-list">
                        {currentDialogData.rules.map((rule: string, idx: number) => (
                          <li key={idx}>{rule}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <p className="cyber-footer-text">CLICK TO CONTINUE</p>
              </div>
            )}

            {/* --- 페이지 2 --- */}
            {currentPage === 2 && (
              <div className="page page-two active">
                <div className="dialog-wrapper">
                  <img src={Hackcat} alt="Guide Avatar" className="guide-avatar" />
                  {/* ✅ 흔들림/글리치 효과 클래스 추가 */}
                  <div className="speech-bubble glitch-bubble">
                    <h2 className="bubble-title">{t('nextStepsTitle')}</h2>
                    <p>{t('nextStepsMessage')}</p>
                    
                    {/* --- 선택지 카드 --- */}
                    <div className="next-steps-container">
                      <Link to="/tutorial" className="step-card">
                        <h3>{t('tutorialLabel')}</h3>
                        <p>{t('tutorialDescription')}</p>
                      </Link>
                      <Link to="/machine" className="step-card">
                        <h3>{t('playLabel')}</h3>
                        <p>{t('playDescription')}</p>
                      </Link>
                      <Link to="/tutorial/play" className="step-card">
                        <h3>{t('startTutorialLabel')}</h3>
                        <p>{t('startTutorialDescription')}</p>
                      </Link>
                      <Link to="/learn" className="step-card">
                        <h3>{t('learnBasicsLabel')}</h3>
                        <p>{t('learnBasicsDescription')}</p>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </Main>
  );
};

export default ManualPage;