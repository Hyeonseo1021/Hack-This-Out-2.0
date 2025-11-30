import React from 'react';
import { MachineDetail as MachineDetailType } from '../../types/Machine';
import '../../assets/scss/machine/MachineDetail.scss';
import Rating from '@mui/material/Rating';
import Box from '@mui/material/Box';
import { avatarBackgroundColors, getAvatarColorIndex } from '../../utils/avatars';
import { Avatar } from '@mui/material';
import { useNavigate } from "react-router-dom";

// 🔥 추가: 고양이 이미지 import
import whiteCat from '../../assets/img/icon/Hack_cat.png';

interface MachineDetailProps {
  machineDetail: MachineDetailType;
}

const MachineDetail: React.FC<MachineDetailProps> = ({ machineDetail }) => {
  const navigate = useNavigate();
  const { _id, name, category, description, exp, rating, difficulty } = machineDetail;

  const avatarColorIndex = getAvatarColorIndex(name);
  const avatarBgColor = avatarBackgroundColors[avatarColorIndex];

  const getDifficultyColor = (level: string): string => {
    const colors: { [key: string]: string } = {
      'very_easy': '#4ade80',
      'easy': '#86efac',
      'medium': '#fbbf24',
      'hard': '#fb923c',
      'very_hard': '#ef4444'
    };
    return colors[level] || '#94a3b8';
  };

  const getDifficultyLabel = (level: string): string => {
    const labels: { [key: string]: string } = {
      'very_easy': 'Very Easy',
      'easy': 'Easy',
      'medium': 'Medium',
      'hard': 'Hard',
      'very_hard': 'Very Hard'
    };
    return labels[level] || 'Unknown';
  };

  const displayDifficulty = difficulty?.confirmedLevel || difficulty?.creatorLevel;

  return (
    <div className="machine-detail-container">
      <div className="machine-detail">

        {/* ==========================================
             🔥 아바타(네모박스) 영역 — 고양이 이미지 적용
        ========================================== */}
        <div className="avatar-container">
          <Avatar
            variant="rounded"
            sx={{
              backgroundColor: avatarBgColor,
              width: '100%',
              height: 'auto',
              aspectRatio: '1 / 1',
              fontSize: 'clamp(3.5rem, 7vw, 5rem)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden'
            }}
          >
            {/* 🔥 H 글자 대신 고양이 이미지 */}
            <img
              src={whiteCat}
              alt="cat"
              style={{
                width: '70%',
                height: '70%',
                objectFit: 'contain',
                pointerEvents: 'none'
              }}
            />
          </Avatar>
        </div>

        {/* ========================================== */}

        <div className='machine-textbox'>
          <p className="machine-name">
            <b>{name.charAt(0).toUpperCase() + name.slice(1)}</b>
          </p>

          <p className='machine-category'><b>Category: </b>{category || 'N/A'}</p>

          {difficulty && displayDifficulty && (
            <div className='machine-difficulty'>
              <b>Difficulty: </b>
              <span 
                className='difficulty-badge'
                style={{ 
                  display: 'inline-block',
                  backgroundColor: getDifficultyColor(displayDifficulty),
                  padding: '4px 12px',
                  borderRadius: '12px',
                  color: '#000',
                  fontWeight: 'bold',
                  marginLeft: '8px',
                  fontSize: '0.9em'
                }}
              >
                {getDifficultyLabel(displayDifficulty)}
                {!difficulty.isConfirmed && ' (Est.)'}
              </span>
            </div>
          )}

          <div className='description'>
            <p>"{description || 'N/A'}"</p>
          </div>
        </div>

        <div className='right-part'>
          <div className='rating-box'>
            <Box sx={{ marginTop: '8px' }}>
              <Rating
                name={`read-only-rating-${_id}`}
                value={Number(rating)}
                precision={0.5}
                readOnly
              />
            </Box>
            <span style={{ marginLeft: '32px', color: '#fff' }}>
              {rating.toFixed(1)} / 5.0
            </span>
          </div>

          <div className='machine-reward-box'>
            <p className='text'>Reward</p>
            <p className='reward-text'>{exp || 0} EXP</p>
          </div>

          <button
            className="machine-play-btn"
            onClick={() => navigate(`/machine/${_id}/play`)}
          >
            Play
          </button>
        </div>

      </div>
    </div>
  );
};

export default MachineDetail;
