import React, { useState } from 'react';
import '../assets/scss/etc/ManualPage.scss';
import Main from '../components/main/Main';
import { Link } from 'react-router-dom';
import Hackcat from "../assets/img/icon/Hack cat.png";
import { useTranslation } from 'react-i18next';

const ManualPage: React.FC = () => {
  const { t, i18n } = useTranslation('manual');
  
  const [currentPage, setCurrentPage] = useState(1);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ko' ? 'en' : 'ko';
    i18n.changeLanguage(newLang);
  };
  
  // ✨ 수정된 부분: t()로 가져온 값이 배열인지 확인하는 안전장치 추가
  const rulesData = t('rules', { returnObjects: true });
  const rules = Array.isArray(rulesData) ? rulesData : [];

  return (
    <Main>
      <div className="manual-beginner-viewport">
        <div className="manual-beginner-container">
          
          <div className="manual-header">
            <h1 className="manual-title">{t('title')}</h1>
            <button className="language-toggle" onClick={toggleLanguage}>
              {i18n.language === 'ko' ? 'EN' : 'KO'}
            </button>
          </div>
          
          <div className="manual-content-area">
            {/* --- 페이지 1 --- */}
            <div className={`page page-one ${currentPage === 1 ? 'active' : 'inactive-left'}`}>
              <div className="dialog-wrapper">
                <img src={Hackcat} alt="Guide Avatar" className="guide-avatar" />
                <div className="speech-bubble">
                  <h2 className="bubble-title">{t('welcomeTitle')}</h2>
                  <p>{t('welcomeMessage')}</p>
                </div>
              </div>
              <div className="dialog-wrapper">
                <img src={Hackcat} alt="Guide Avatar" className="guide-avatar" />
                <div className="speech-bubble">
                  <h2 className="bubble-title">{t('guideTitle')}</h2>
                  <ul className="rules-list">
                    {/* 이제 rules가 항상 배열이므로 에러가 발생하지 않습니다. */}
                    {rules.map((rule, index) => <li key={index}>{rule}</li>)}
                  </ul>
                </div>
              </div>
            </div>

            {/* --- 페이지 2 --- */}
            <div className={`page page-two ${currentPage === 2 ? 'active' : 'inactive-right'}`}>
              <div className="dialog-wrapper">
                <img src={Hackcat} alt="Guide Avatar" className="guide-avatar" />
                <div className="speech-bubble">
                  <h2 className="bubble-title">{t('nextStepsTitle')}</h2>
                  <p>{t('nextStepsMessage')}</p>
                  
                  {/* --- 4개의 선택지 카드 컨테이너 --- */}
                  <div className="next-steps-container">
                    {/* 기존 선택지 1 */}
                    <Link to="/tutorial" className="step-card">
                      <h3>{t('tutorialLabel')}</h3>
                      <p>{t('tutorialDescription')}</p>
                    </Link>
                    {/* 기존 선택지 2 */}
                    <Link to="/machine" className="step-card">
                      <h3>{t('playLabel')}</h3>
                      <p>{t('playDescription')}</p>
                    </Link>
                    {/* 새로운 선택지 1 */}
                    <Link to="/tutorial/play" className="step-card">
                      <h3>{t('startTutorialLabel')}</h3>
                      <p>{t('startTutorialDescription')}</p>
                    </Link>
                    {/* 새로운 선택지 2 */}
                    <Link to="/learn" className="step-card">
                      <h3>{t('learnBasicsLabel')}</h3>
                      <p>{t('learnBasicsDescription')}</p>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* --- 페이지네이션 컨트롤 --- */}
          <div className="manual-pagination-controls">
            {currentPage > 1 && (
              <button onClick={() => setCurrentPage(currentPage - 1)} className="page-button prev">
                {t('prevPage')}
              </button>
            )}
            {currentPage < 2 && (
              <button onClick={() => setCurrentPage(currentPage + 1)} className="page-button next">
                {t('nextPage')}
              </button>
            )}
          </div>
        </div>
      </div>
    </Main>
  );
};

export default ManualPage;