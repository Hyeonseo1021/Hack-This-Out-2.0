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

  // 페이지2 대화 데이터 (4개의 말풍선)
  const stepDialogs = [
    { label: t('tutorialLabel'), desc: t('tutorialDescription'), to: "/tutorial" },
    { label: t('playLabel'), desc: t('playDescription'), to: "/machine" },
    { label: t('startTutorialLabel'), desc: t('startTutorialDescription'), to: "/tutorial/play" },
    { label: t('learnBasicsLabel'), desc: t('learnBasicsDescription'), to: "/learn" },
  ];

  const handleNextDialog = () => {
    if (currentPage === 1) {
      if (currentDialog < dialogs.length - 1) {
        setCurrentDialog(currentDialog + 1);
      } else {
        setCurrentPage(2);
        setCurrentDialog(0);
      }
    } else if (currentPage === 2) {
      if (currentDialog < stepDialogs.length - 1) {
        setCurrentDialog(currentDialog + 1);
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
          
          {/* --- 화면 클릭 시 다음 --- */}
          <div className="manual-content-area" onClick={handleNextDialog}>
            
            {/* --- 페이지 1 --- */}
            {currentPage === 1 && (
              <div className="page page-one active">
                <div className="dialog-wrapper active">
                  <img src={Hackcat} alt="Guide Avatar" className="guide-avatar" />
                  <div className="speech-bubble">
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

            {/* --- 페이지 2 (말풍선 하나씩 클릭 시 나타나기) --- */}
            {currentPage === 2 && (
              <div className="page page-two active">
                {stepDialogs.map((step, idx) => (
                  <div 
                    key={idx} 
                    className={`dialog-wrapper ${idx <= currentDialog ? "active" : ""}`}
                  >
                    <img src={Hackcat} alt="Guide Avatar" className="guide-avatar" />
                    <div className="speech-bubble">
                      <h2 className="bubble-title">{step.label}</h2>
                      <p>{step.desc}</p>
                      <Link to={step.to} className="nav-button">Go</Link>
                    </div>
                  </div>
                ))}
                <p className="cyber-footer-text">CLICK TO CONTINUE</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </Main>
  );
};

export default ManualPage;