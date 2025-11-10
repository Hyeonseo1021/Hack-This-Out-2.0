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

  // ✅ 언어 토글 버튼 클릭 시 한/영 전환
  const toggleLanguage = () => {
    const newLang = i18n.language === 'ko' ? 'en' : 'ko';
    i18n.changeLanguage(newLang);
  };
  
  // 다국어 리소스 로드
  const rulesData = t('rules', { returnObjects: true });
  const rules = Array.isArray(rulesData) ? rulesData : [];

  // 대화(인트로) 데이터
  const dialogs = [
    { title: t('welcomeTitle'), message: t('welcomeMessage') },
    { title: t('guideTitle'), rules: rules },
  ];

  // Step별 이동 대상 데이터
  const stepDialogs = [
    { label: t('tutorialLabel'), desc: t('tutorialDescription'), to: "/tutorial" },
    { label: t('startTutorialLabel'), desc: t('startTutorialDescription'), to: "/tutorial/play" },
    { label: t('learnBasicsLabel'), desc: t('learnBasicsDescription'), to: "/learn" },
    { label: t('playLabel'), desc: t('playDescription'), to: "/machine" },

  ];

  // ✅ 클릭으로 페이지 및 대화 흐름 제어
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
          
          {/* --- 헤더 (타이틀 + 언어 토글) --- */}
          <div className="manual-header">
            <h1 className="manual-title" data-text={t('title')}>
              {t('title')}
            </h1>

            {/* ✅ 네온 CRT 테마 언어 토글 버튼 */}
            <button className="language-toggle neon-toggle" onClick={toggleLanguage}>
              {i18n.language === 'ko' ? 'EN' : 'KO'}
            </button>
          </div>
          
          {/* --- 메인 콘텐츠 영역 (클릭 시 페이지 전환) --- */}
          <div className="manual-content-area" onClick={handleNextDialog}>
            
            {/* --- 페이지 1 : 인트로 --- */}
            {currentPage === 1 && (
              <div className="page page-one active">
                <div className="dialog-wrapper active">
                  <img src={Hackcat} alt="Guide Avatar" className="guide-avatar" />

                  {/* ✅ 글리치 효과 텍스트 */}
                  <div className="dialogue-bubble">
                    <span className="glitch-text" data-text={t('welcomeTitle')}>
                      {t('welcomeTitle')}
                    </span>
                    <p className="glitch-subtext" data-text={t('welcomeMessage')}>
                      {t('welcomeMessage')}
                    </p>
                  </div>
                </div>

                {/* ✅ 첫 번째 페이지에서만 표시 */}
                <p className="cyber-footer-text">CLICK TO CONTINUE</p>
              </div>
            )}

            {/* --- 페이지 2 : 메뉴 선택 화면 --- */}
            {currentPage === 2 && (
              <div className="page page-two active">
                {stepDialogs.map((step, idx) => (
                  <div 
                    key={idx} 
                    className={`dialog-wrapper ${idx <= currentDialog ? "active" : ""}`}
                  >
                    <img src={Hackcat} alt="Guide Avatar" className="guide-avatar" />

                    {/* ✅ 말풍선 전체를 클릭하면 이동 */}
                    <Link to={step.to} className="speech-bubble link-bubble">
                      <h2 
                        className="glitch-text" 
                        data-text={step.label}
                      >
                        {step.label}
                      </h2>
                      <p 
                        className="glitch-subtext" 
                        data-text={step.desc}
                      >
                        {step.desc}
                      </p>
                    </Link>
                  </div>
                ))}

                {/* ❌ 두 번째 페이지에서는 CLICK TO CONTINUE 제거 */}
              </div>
            )}

          </div>
        </div>
      </div>
    </Main>
  );
};

export default ManualPage;