// src/pages/contest/ContestList.tsx
import React, { useState, useEffect } from 'react';
import { getActiveContests } from '../../api/axiosContest';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../../utils/dateUtils';

import styles from '../../assets/scss/contest/ContestList.module.scss';
import { Avatar } from '@mui/material';
import { avatarBackgroundColors, getAvatarColorIndex } from '../../utils/avatars';
import LoadingIcon from '../public/LoadingIcon';
import { IoMdArrowRoundForward } from 'react-icons/io';

interface Contest {
  _id: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  contestExp: number;
  isActive: boolean;
}

interface ContestsResponse {
  ongoingContests: Contest[];
  notStartedContests: Contest[];
  endedContests: Contest[];
}

const ContestList: React.FC = () => {
  const [ongoingContests, setOngoingContests] = useState<Contest[]>([]);
  const [notStartedContests, setNotStartedContests] = useState<Contest[]>([]);
  const [endedContests, setEndedContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] =
    useState<'ongoing' | 'notStarted' | 'ended'>('ongoing');

  const navigate = useNavigate();

  const fetchContests = async () => {
    try {
      const data: ContestsResponse = await getActiveContests();
      setOngoingContests(data.ongoingContests);
      setNotStartedContests(data.notStartedContests);
      setEndedContests(data.endedContests);
    } catch (error) {
      console.error('Error fetching contests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContests();
  }, []);

  const handleContestClick = (contestId: string) => {
    navigate(`/contest/${contestId}`);
  };

  const getList = () => {
    if (activeTab === 'ongoing') return ongoingContests;
    if (activeTab === 'notStarted') return notStartedContests;
    return endedContests;
  };

  const list = getList();

  return (
    <div className={styles.contest_list_container}>
      <h2 className={styles.contest_title}>Contests</h2>

          {/* 탭 */}
      <div className={styles.tabs}>
        {['ongoing', 'notStarted', 'ended'].map((tab) => (
          <button
            key={tab}
            className={`${styles.tab_button} ${
              activeTab === tab ? styles.active : ''
            }`}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab === 'ongoing' && 'Ongoing'}
            {tab === 'notStarted' && 'Not Started'}
            {tab === 'ended' && 'Ended'}
          </button>
        ))}
      </div>

      {/* 카드 리스트 */}
      <div className={styles.card_grid}>
        {loading ? (
          <LoadingIcon />
        ) : list.length === 0 ? (
          <p className={styles.no_contests}>No contests available.</p>
        ) : (
          list.map((item) => (
            <div
              key={item._id}
              className={styles.contest_card}
              onClick={() => handleContestClick(item._id)}
            >
              <div className={styles.card_header}>
                <Avatar
                  variant="rounded"
                  sx={{
                    backgroundColor:
                      avatarBackgroundColors[getAvatarColorIndex(item.name)],
                    width: 52,
                    height: 52,
                  }}
                >
                  {item.name.charAt(0).toUpperCase()}
                </Avatar>

                <div className={styles.card_title}>
                  {item.name.charAt(0).toUpperCase() + item.name.slice(1)}
                </div>

                <div className={styles.go_icon}>
                  <IoMdArrowRoundForward />
                </div>
              </div>

              <div className={styles.card_info}>
                <p>📅 Start: {formatDate(item.startTime)}</p>
                <p>⏳ End: {formatDate(item.endTime)}</p>
                <p>⭐ Reward: {item.contestExp} EXP</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ContestList;
