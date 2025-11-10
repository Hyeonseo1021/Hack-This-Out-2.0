import { useEffect, useState } from "react";
import { getMyRank } from "../../api/axiosUser";
import { CurrentUser } from "../../types/CurrentUser";
import ErrorIcon from "../public/ErrorIcon";
import LoadingIcon from "../public/LoadingIcon";
import { Avatar, Badge, Box, Typography, CircularProgress } from "@mui/material";
import { avatarBackgroundColors, getAvatarColorIndex } from "../../utils/avatars";
import { styled } from "@mui/material/styles";
import '../../assets/scss/mypage/userStats.scss';
import { getLevelFrame, getRankBadge, levelFrames, rankBadges } from "../../utils/badge";

// Define the props for StyledBadge to include the frame number
interface StyledBadgeProps {
  frame: number;
}

// StyledBadge component that dynamically changes the badge frame based on the `frame` prop
const StyledBadge = styled(Badge)<StyledBadgeProps>(() => ({
  '& .MuiBadge-badge': {
    backgroundColor: 'transparent',
    padding: 0,
    minHeight: 'auto',
    minWidth: 'auto',
    borderRadius: '50%',
    width: 230,
    height: 230,
    position: 'absolute',
    top: -155,
    left: -155,
    '& img': {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    },
  },
}));

const UserStats = () => {
  const [myStats, setMyStats] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await getMyRank();
        setMyStats({
          _id: response.user._id,
          myRank: response.myRank,
          myLevel: response.user.level,
          myExp: response.user.exp,
          myUsername: response.user.username,
          myAvatar: response.user.avatar,
        });
      } catch (err: any) {
        setError(err.message || "An error occurred while fetching data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingIcon />;
  if (error) return <ErrorIcon />;

  if (!myStats) {
    return <Box>No data available.</Box>;
  }

  const avatarBgColor = avatarBackgroundColors[getAvatarColorIndex(myStats.myUsername || '')];

  // ✅ 경험치 테이블 (백엔드와 반드시 일치)
  const levels = [
    0, 100, 300, 600, 1000, 1500, 2100, 3000, 4000, 5000,
    6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000
  ];

  // ✅ 현재 레벨 진행률 계산 함수
  const getLevelProgress = (level: number, exp: number) => {
    const prev = levels[level - 1] ?? 0;
    const next = levels[level] ?? levels[levels.length - 1];
    const pct = ((exp - prev) / (next - prev)) * 100;
    return {
      percentage: Math.min(Math.max(pct, 0), 100),
      remain: Math.max(next - exp, 0),
      nextLevelExp: next,
    };
  };

  const { percentage: expPercentage, remain: remainExp, nextLevelExp } = getLevelProgress(
    myStats.myLevel || 1,
    myStats.myExp || 0
  );

  const levelFrame = getLevelFrame(myStats.myLevel || 1);
  const rankBadge = getRankBadge(myStats.myRank || 0);

  return (
    <Box className="stats-container">
      <Typography className="stats-header">{myStats?.myUsername}'s Stats</Typography>

      <Box className="stats-upper-container">
        {/* === 아바타 영역 === */}
        <Box className="stats-avatar">
          <StyledBadge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            variant="standard"
            frame={levelFrame}
            badgeContent={<img src={levelFrames[levelFrame]} alt="Level Frame" />}
          >
            <Avatar
              alt={myStats?.myUsername || ''}
              className="stats-avatar-image"
              sx={{
                backgroundColor: avatarBgColor
              }}
            >
              {myStats?.myUsername?.charAt(0).toUpperCase() || ''}
            </Avatar>
          </StyledBadge>
        </Box>

        {/* === 진행률 바 === */}
        <Box className="stats-progress">
          <Box className="stats-progress-container">
            <CircularProgress
              variant="determinate"
              value={expPercentage}
              size={200}
              thickness={4}
              className="progress-bar"
              aria-label={`Level ${myStats?.myLevel}, ${Math.round(expPercentage)}% to next level`}
            />
            <Box className="progress-text">
              <Typography style={{ fontSize: "1.5rem", fontWeight: "bold" }} component="div" color="var(--color-white)">
                LVL. {myStats?.myLevel}
              </Typography>
              <Typography variant="h6" component="div" color="var(--color-white)">
                {Math.round(expPercentage)}%
              </Typography>
            </Box>
          </Box>
          <Typography className="next-level" variant="h6" component="div">
            Next Level: {remainExp} EXP
          </Typography>
        </Box>

        {/* === 랭킹 뱃지 === */}
        <Box className="stats-rank">
          <Avatar src={rankBadges[rankBadge]} className="rank-badge" />
          <Typography variant="h6">Ranking #{myStats?.myRank}</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default UserStats;
