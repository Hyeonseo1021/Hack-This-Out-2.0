import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Main from '../../components/main/Main';
import '../../assets/scss/battle/BattlePage.scss';

const BattlePage: React.FC = () => {
  const { t } = useTranslation('common');

  return (
    <Main>
      <div className="battle-cyber-container">
        {/* 동적인 배경 효과를 위한 요소 */}
        <div className="battle-background-grid"></div>

        <div className="battle-mode-module">
          {/* 타이틀에 글리치 효과를 위한 데이터 속성 추가 */}
          <h1 className="battle-title" data-text={t('battle.title')}>
            {t('battle.title')}
          </h1>

          <div className="battle-selection-wrapper">
            <Link to="/contest" className="battle-button">
              <span data-text={t('battle.contests')}>{t('battle.contests')}</span>
              <div className="button-loader"></div>
            </Link>

            <Link to="/arena" className="battle-button">
              <span data-text={t('battle.arena')}>{t('battle.arena')}</span>
              <div className="button-loader"></div>
            </Link>
          </div>

          <p className="cyber-footer-text">{t('battle.systemReady')}</p>
        </div>
      </div>
    </Main>
  );
};

export default BattlePage;