import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getLeaderboard, getMyRank } from '../../api/axiosUser';
import Main from '../../components/main/Main';
import Loading from '../../components/public/Loading';
import { User } from '../../types/User';
import { CurrentUser } from '../../types/CurrentUser';
import "../../assets/scss/leaderboard/LearderboardPage.scss";

const LeaderBoardPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [leaderboard, setLeaderboard] = useState<Partial<User>[]>([]);
  const [myRank, setMyRank] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [leaderboardData, myRankData] = await Promise.all([
          getLeaderboard(),
          getMyRank()
        ]);

        // ✅ 백엔드 응답 형식에 맞게 데이터 추출
        setLeaderboard(leaderboardData?.users || []);
        setMyRank({
          _id: myRankData?.user?._id || null,
          myUsername: myRankData?.user?.username || 'Guest',
          myLevel: myRankData?.user?.level || 1,
          myExp: myRankData?.user?.exp || 0,
          myRank: myRankData?.myRank || null,
          myAvatar: myRankData?.user?.avatar || null
        });
      } catch (err: any) {
        console.error('❌ Error fetching leaderboard:', err);
        setError(err?.response?.data?.message || 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <Loading />;
  }

  return (
    <Main>
      <div className="leaderboard-cyber">
        {/* 🔹 노이즈 오버레이 (상단용) */}
        <div className="overlay-noise" />

        {/* 헤더 */}
        <header className="cyber-header">
          <h1 className="title-glitch" data-text={t('leaderboard.title')}>
            <span className="text">{t('leaderboard.title')}</span>
          </h1>
        </header>

        {/* 에러 메시지 */}
        {error && (
          <div className="error-banner" style={{
            padding: '15px',
            margin: '20px',
            background: 'rgba(255, 68, 68, 0.2)',
            border: '2px solid #ff4444',
            borderRadius: '8px',
            color: '#ff8a80',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* 메인 콘텐츠 */}
        <div className="leaderboard-grid">
          {/* 좌측 랭킹 */}
          <section className="main-board">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>{t('leaderboard.rank')}</th>
                  <th>{t('leaderboard.user')}</th>
                  <th>{t('leaderboard.level')}</th>
                  <th>{t('leaderboard.exp')}</th>
                  <th>{t('leaderboard.progress')}</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length > 0 ? (
                  leaderboard.map((user, idx) => (
                    <tr key={user._id || idx} className={user.username === myRank?.myUsername ? "you" : ""}>
                      <td>{idx + 1}</td>
                      <td>{user.username || 'Unknown'}</td>
                      <td>{user.level || 1}</td>
                      <td>{user.exp || 0}</td>
                      <td>
                        <div className="exp-bar">
                          <div
                            className="fill"
                            style={{ width: `${Math.min(((user.exp || 0) / ((user.level || 1) * 100)) * 100, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.5)' }}>
                      {t('leaderboard.noData')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* 우측 플레이어 상태 */}
          <aside className="user-hud">
            <h2>{t('leaderboard.playerStatus')}</h2>
            <div className="hud-info">
              <p>
                USERNAME: <span>{myRank?.myUsername || 'Guest'}</span>
              </p>
              <p>
                LEVEL: <span>{myRank?.myLevel || 1}</span>
              </p>
              <p>
                EXP: <span>{myRank?.myExp || 0}</span>
              </p>
              <p>
                RANK: <span>{myRank?.myRank || 'N/A'}</span>
              </p>
              <div className="hud-bar">
                <div className="fill" style={{
                  width: `${Math.min(((myRank?.myExp || 0) / ((myRank?.myLevel || 1) * 100)) * 100, 100)}%`
                }} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Main>
  );
};

export default LeaderBoardPage;