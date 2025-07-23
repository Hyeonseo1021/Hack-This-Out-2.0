import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../assets/scss/battle/BattleCard.scss';

interface BattleCardProps {
  title: string;
  description: string;
  route: string;
}

const BattleCard: React.FC<BattleCardProps> = ({ title, description, route }) => {
  const navigate = useNavigate();

  return (
    <div className="battle-card" onClick={() => navigate(route)}>
      <div className="card-inner">
        <div className="card-front">
          <div className="card-title">{title}</div>
        </div>
        <div className="card-back">
          <div className="card-description">{description}</div>
        </div>
      </div>
    </div>
  );
};

export default BattleCard;
