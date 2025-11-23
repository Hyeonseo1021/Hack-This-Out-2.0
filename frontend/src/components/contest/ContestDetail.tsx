import React from 'react';
import { formatDate } from '../../utils/dateUtils';
import { ContestDetail as ContestDetailType } from '../../types/Contest';
import styles from '../../assets/scss/contest/ContestDetail.module.scss';
import { Avatar } from '@mui/material';
import { getAvatarColorIndex, avatarBackgroundColors } from '../../utils/avatars';

interface ContestDetailProps {
  contestDetail: ContestDetailType;
}

const ContestDetail: React.FC<ContestDetailProps> = ({ contestDetail }) => {
  const { name, contestExp, machines, description, startTime, endTime } = contestDetail;

  const avatarColorIndex = getAvatarColorIndex(name);
  const avatarBgColor = avatarBackgroundColors[avatarColorIndex];

  return (
    <div className={styles.detail_container}>
      {/* 왼쪽 - Avatar */}
      <div className={styles.avatar_container}>
        <Avatar
          variant="rounded"
          sx={{
            backgroundColor: avatarBgColor,
            width: 'clamp(90px, 12vw, 130px)',
            height: 'clamp(90px, 12vw, 130px)',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
          }}
        >
          {name.charAt(0).toUpperCase()}
        </Avatar>
      </div>

      {/* 텍스트 */}
      <div className={styles.text_box}>
        <h2 className={styles.name}>{name}</h2>
        <p className={styles.desc}>"{description}"</p>

        <p className={styles.machines}>
          <strong>Machines: </strong>
          {machines.map((m) => m.name).join(', ')}
        </p>

        <p className={styles.time}>
          <strong>Starts at: </strong> {formatDate(startTime)}
        </p>
        <p className={styles.time}>
          <strong>Ends at: </strong> {formatDate(endTime)}
        </p>

        <p className={styles.reward}>
          <strong>Reward:</strong> {contestExp} EXP
        </p>
      </div>
    </div>
  );
};

export default ContestDetail;
