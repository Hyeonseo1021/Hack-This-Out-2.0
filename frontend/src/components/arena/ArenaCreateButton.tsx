import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../assets/scss/arena/ArenaCreateButton.scss';

interface CreateArenaButtonProps {
  title: string;
  route: string;
}

const CreateArenaButton: React.FC<CreateArenaButtonProps> = ({ title, route }) => {
  const navigate = useNavigate();

  return (
    <div className="create-arena" onClick={() => navigate(route)}>
        <div className="create-arena-title">{title}</div>
    </div>
  );
};

export default CreateArenaButton;
