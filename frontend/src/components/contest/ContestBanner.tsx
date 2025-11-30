import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Carousel from 'react-material-ui-carousel';
import { ContestBannerItem } from '../../types/Contest';
import '../../assets/scss/contest/ContestBanner.scss';
import { useNavigate } from 'react-router-dom';
import { Paper, Button, Avatar } from '@mui/material';
import { ArrowForwardIos, ArrowBackIos } from '@mui/icons-material';
import { getAvatarColorIndex, avatarBackgroundColors } from '../../utils/avatars';
import { formatRemainingTime } from '../../utils/dateUtils';
import { getLatestContest } from '../../api/axiosContest';
import { getStartedContest } from '../../api/axiosContest';
import LoadingIcon from '../public/LoadingIcon';
import ErrorIcon from '../public/ErrorIcon';

const ContestBanner: React.FC = () => {
  const { t } = useTranslation('contest');
  const [latestContest, setLatestContest] = useState<ContestBannerItem | null>(null);
  const [startedContest, setStartedContest] = useState<ContestBannerItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        setLoading(true);
        const latest = await getLatestContest();
        const started = await getStartedContest();
        setLatestContest(latest.contest);
        setStartedContest(started.contest);
        //if started contest is null, set started contest to latest contest
        if (!started.contest) {
          setStartedContest(latest.contest);
        }
      } catch (err: any) {
        console.error('Error fetching machines for banner:', err);
        setError('Failed to load machine banners.');
      } finally {
        setLoading(false);
      }
    };

    fetchMachines();
  }, []);

  if (loading) {
    return <LoadingIcon />;
  }

  if (error) {
    return <ErrorIcon />;
  }

  const contests = [
    { ...latestContest!, title: t('banner.latest') },
    { ...startedContest!, title: t('banner.ongoing') },
  ];

  return (
    <div className="contest-banner-container">
      <Carousel
        className='carousel'
        navButtonsAlwaysVisible
        indicators={false}
        autoPlay
        interval={10000}
        animation="slide"
        swipe
        navButtonsProps={{
          style: {
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: '#fff',
          },
        }}
        navButtonsWrapperProps={{
          style: {
            height: '100%',
            bottom: '0',
          },
        }}
        NextIcon={<ArrowForwardIos />}
        PrevIcon={<ArrowBackIos />}
      >
        {contests.map((contest) => {
          const avatarColorIndex = getAvatarColorIndex(contest.name);
          const avatarBgColor = avatarBackgroundColors[avatarColorIndex];
          return (
            <Paper key={contest._id} className="banner-slide">
              <div className="banner-contents">
                <h3>{contest.title}</h3>
                <Avatar className='contest-avatar'
                  variant="rounded"
                  sx={{
                    backgroundColor: avatarBgColor
                  }}
                >
                  {contest?.name ? contest.name.charAt(0).toUpperCase() : "?"}
                </Avatar>
                <h4><b>{contest?.name ? contest.name.charAt(0).toUpperCase() + contest.name.slice(1) : t('banner.nothingNew')}</b></h4>
                {new Date(contest.startTime) > new Date() ? (
                  <p className='ramaining-time'>{t('startsIn')} {formatRemainingTime(contest.startTime)}</p>
                ) : (
                  contest.endTime ? (
                    <p className='ramaining-time'>{t('endsIn')} {formatRemainingTime(contest.endTime)}</p>
                  ) : (
                    <p className='ramaining-time'>{t('noParticipants')}</p>
                  )
                )}
                <div className='contest_reward_box'>
                  <p className='banner-exp'>{t('reward')}</p>
                  <p className='exp'>{contest.contestExp} EXP</p>
                </div>
                <Button
                  className='go-to-machine-btn'
                  variant="contained"
                  onClick={() => navigate(`/contest/${contest._id}`)}
                >
                  {t('goToContest')}
                </Button>
              </div>
            </Paper>
          );
        })}
      </Carousel>
    </div>
  );
};

export default ContestBanner;