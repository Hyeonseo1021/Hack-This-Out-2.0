import React, { useState, useEffect } from 'react';
import { getLeaderboard } from '../../api/axiosUser';
import LeaderboardTable from './LeaderBoardTable';
import Main from '../../components/main/Main';
import { User } from '../../types/User';
import "../../assets/scss/leaderboard/LearderboardPage.scss";
import "../../assets/scss/leaderboard/LeaderboardTable.module.scss";
import "../../assets/scss/leaderboard/ContestLeaderboard.module.scss";
import "../../assets/scss/leaderboard/CurrentUserInfo.module.scss";
import "../../assets/scss/leaderboard/HoldCard.scss";

// 🔹 홀로그램 카드 컴포넌트
const HoloCard: React.FC<{ rank: number; username: string; level: number; exp: number }> = ({
  rank,
  username,
  level,
  exp,
}) => {
  return (
    <div className={`holo-card rank-${rank}`}>
      <div className="holo-panel">
        <div className="holo-beam"></div>
        <div className="holo-ring"></div>
        <div className="holo-particles"></div>

        <div className="holo-info">
          <h2>{rank}위</h2>
          <p>{username}</p>
          <p>Lv. {level}</p>
          <p>EXP {exp}</p>
        </div>
      </div>
    </div>
  );
};

// 🔹 리더보드 페이지 본체
const LeaderBoardPage: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const leaderboardData = await getLeaderboard();
        const list = Array.isArray(leaderboardData)
          ? leaderboardData
          : leaderboardData?.data || [];

        if (!list || list.length === 0) {
          setLeaderboard([
            { username: "Alpha", level: 10, exp: 1200 },
            { username: "Beta", level: 8, exp: 900 },
            { username: "Gamma", level: 7, exp: 700 },
          ] as User[]);
        } else {
          setLeaderboard(list);
        }
      } catch (err) {
        console.error("리더보드 데이터를 불러오는 중 오류 발생:", err);
        setLeaderboard([
          { username: "Alpha", level: 10, exp: 1200 },
          { username: "Beta", level: 8, exp: 900 },
          { username: "Gamma", level: 7, exp: 700 },
        ] as User[]);
      }
    };
    fetchData();
  }, []);

  const topThree = leaderboard.slice(0, 3);

  return (
    <Main>
      <div className="leaderboard-container">
        {!expanded ? (
          <>
            <h1 className="leaderboard-title"> TOP 3 RANKERS </h1>

            {/* 🔹 카드 배열 구조 변경 */}
            <div className="holo-layout">
              <div className="holo-top">
                {topThree[0] && (
                  <HoloCard
                    rank={1}
                    username={topThree[0].username}
                    level={topThree[0].level}
                    exp={topThree[0].exp}
                  />
                )}
              </div>

              <div className="holo-bottom">
                {topThree[1] && (
                  <HoloCard
                    rank={2}
                    username={topThree[1].username}
                    level={topThree[1].level}
                    exp={topThree[1].exp}
                  />
                )}
                {topThree[2] && (
                  <HoloCard
                    rank={3}
                    username={topThree[2].username}
                    level={topThree[2].level}
                    exp={topThree[2].exp}
                  />
                )}
              </div>
            </div>

            <button className="toggle-btn" onClick={() => setExpanded(true)}>
              전체 보기
            </button>
          </>
        ) : (
          <div className="expanded-view">
            <h1 className="leaderboard-title">전체 리더보드</h1>
            <LeaderboardTable leaderboard={leaderboard} />
            <button className="toggle-btn" onClick={() => setExpanded(false)}>
              TOP 3 보기
            </button>
          </div>
        )}
      </div>
    </Main>
  );
};

export default LeaderBoardPage;