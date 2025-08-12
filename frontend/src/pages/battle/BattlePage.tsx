import React from 'react';
import Main from '../../components/main/Main';
import BattleCard from '../../components/battle/BattleCard';
import '../../assets/scss/battle/BattlePage.scss';

const BattlePage: React.FC = () => {
  return (
    <Main>
      <div className="battle-container">
          <h1 className="battle-title">Battle</h1>
        
          <BattleCard
            title="CONTESTS"
            description="기간 내 문제 풀이 경쟁"
            route="/contest"
          />
          <BattleCard
            title="ARENA"
            description="여러 유저와 자유 대결"
            route="/arena"
          />
          <BattleCard
            title="1V1 MATCH"
            description="티어 기반 자동 매칭"
            route="/match"
          />
      </div>
    </Main>
  );
};

export default BattlePage;
