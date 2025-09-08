import React from 'react';
import { Link } from 'react-router-dom';
import Main from '../../components/main/Main';
import '../../assets/scss/battle/BattlePage.scss';

const BattlePage: React.FC = () => {
  return (
    <Main>
      <div className="battle-cyber-container">
        {/* 동적인 배경 효과를 위한 요소 */}
        <div className="background-grid"></div>

        <div className="mode-module">
          {/* 타이틀에 글리치 효과를 위한 데이터 속성 추가 */}
          <h1 className="mode-title" data-text="BATTLE">
            BATTLE
          </h1>
          
          <div className="selection-wrapper">
            <Link to="/contest" className="mode-button">
              <span data-text="CONTESTS">CONTESTS</span>
              <div className="button-loader"></div>
            </Link>
            
            <Link to="/arena" className="mode-button">
              <span data-text="ARENA">ARENA</span>
              <div className="button-loader"></div>
            </Link>
          </div>
          
          <p className="cyber-footer-text">SYSTEM READY</p>
        </div>
      </div>
    </Main>
  );
};

export default BattlePage;