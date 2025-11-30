import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserProgress } from "../../api/axiosUser";
import { getContestParticipations } from "../../api/axiosContest";
import { getArenaHistory } from "../../api/axiosArena"; // ✅ 새로 추가
import LoadingIcon from "../public/LoadingIcon";
import ErrorIcon from "../public/ErrorIcon";
import { UserProgressItem, ContestParticipationItem, ArenaHistoryItem } from "../../types/Progress";
import { formatDate, formatTimeSpent } from "../../utils/dateUtils";
import { Avatar } from "@mui/material";
import { avatarBackgroundColors, getAvatarColorIndex } from "../../utils/avatars";
import '../../assets/scss/mypage/Progress.scss';

const Progress = () => {
  const { t } = useTranslation('user');
  const [userProgress, setUserProgress] = useState<UserProgressItem[]>([]);
  const [contestParticipation, setContestParticipation] = useState<ContestParticipationItem[]>([]);
  const [arenaHistory, setArenaHistory] = useState<ArenaHistoryItem[]>([]); // ✅ 추가
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"machine" | "contest" | "arena">("machine");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [progressRes, contestRes, arenaRes] = await Promise.all([
          getUserProgress(),
          getContestParticipations(),
          getArenaHistory(), // ✅ Arena 기록 불러오기
        ]);

        setUserProgress(progressRes.userProgress);
        setContestParticipation(contestRes.participations);
        setArenaHistory(arenaRes.arenaHistory || []);
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

  return (
    <div className="progress-container">
      <h2>{t('mystats.history')}</h2>
      <div className="tabs">
        <button className={`tab-button ${activeTab === "machine" ? "active" : ""}`} onClick={() => setActiveTab("machine")}>
          {t('mystats.tabs.machine')}
        </button>
        <button className={`tab-button ${activeTab === "contest" ? "active" : ""}`} onClick={() => setActiveTab("contest")}>
          {t('mystats.tabs.contest')}
        </button>
        <button className={`tab-button ${activeTab === "arena" ? "active" : ""}`} onClick={() => setActiveTab("arena")}>
          {t('mystats.tabs.arena')}
        </button>
      </div>

      {/* ✅ Arena History 추가 */}
      {activeTab === "arena" ? (
        arenaHistory.length > 0 ? (
          <div className="table-wrapper">
            <table className="arena-table">
              <thead>
                <tr className="head-detail">
                  <th className="head-name">{t('mystats.arena.name')}</th>
                  <th className="head-category">{t('mystats.arena.mode')}</th>
                  <th className="head-time">{t('mystats.arena.endTime')}</th>
                  <th className="head-winner">{t('mystats.arena.winner')}</th>
                  <th className="head-rank">{t('mystats.arena.myRank')}</th>
                  <th className="head-exp">{t('mystats.arena.expEarned')}</th>
                </tr>
              </thead>
              <tbody>
                {arenaHistory.map((arena) => {
                  const arenaName = arena.name || "Unnamed";
                  const avatarColorIndex = getAvatarColorIndex(arenaName);
                  const avatarBgColor = avatarBackgroundColors[avatarColorIndex];
                  return (
                    <tr className="body-detail" key={arena._id}>
                      <td className="body-name">
                        <Avatar variant="rounded" sx={{ backgroundColor: avatarBgColor, width: 40, height: 40 }}>
                          {arenaName.charAt(0).toUpperCase()}
                        </Avatar>{" "}
                        {arenaName}
                      </td>
                      <td className="body-category">{arena.mode}</td>
                      <td className="body-time">{arena.endTime ? formatDate(arena.endTime) : "-"}</td>
                      <td className="body-winner">{arena.winner?.username || "N/A"}</td>
                      <td className="body-rank">#{arena.myRank || "-"}</td>
                      <td className="body-exp">+{arena.myExpEarned || 0} EXP</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>{t('mystats.arena.noHistory')}</p>
        )
      ) : activeTab === "machine" ? (
        // 기존 Machine 탭 유지
        userProgress.length > 0 ? (
          <div className="table-wrapper">
            <table className="progress-table">
              <thead>
                <tr className="head-detail">
                  <th>{t('mystats.machine.name')}</th>
                  <th>{t('mystats.machine.exp')}</th>
                  <th>{t('mystats.machine.time')}</th>
                  <th>{t('mystats.machine.hintsUsed')}</th>
                  <th>{t('mystats.machine.completed')}</th>
                </tr>
              </thead>
              <tbody>
                {userProgress.map((p) => (
                  <tr key={p._id}>
                    <td>{p.machine?.name || "Unknown"}</td>
                    <td>{p.expEarned} EXP</td>
                    <td>{formatTimeSpent(new Date(p.timeSpent))}</td>
                    <td>{p.hintsUsed}</td>
                    <td>{p.completedAt ? formatDate(p.completedAt) : t('mystats.machine.notCompleted')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>{t('mystats.machine.noHistory')}</p>
        )
      ) : (
        // Contest 탭
        contestParticipation.length > 0 ? (
          <div className="table-wrapper">
            <table className="contest-table">
              <thead>
                <tr>
                  <th>{t('mystats.contest.name')}</th>
                  <th>{t('mystats.contest.start')}</th>
                  <th>{t('mystats.contest.end')}</th>
                  <th>{t('mystats.contest.exp')}</th>
                  <th>{t('mystats.contest.machines')}</th>
                </tr>
              </thead>
              <tbody>
                {contestParticipation.map((c) => (
                  <tr key={c._id}>
                    <td>{c.contest.name}</td>
                    <td>{formatDate(c.participationStartTime)}</td>
                    <td>{c.participationEndTime ? formatDate(c.participationEndTime) : t('mystats.contest.ongoing')}</td>
                    <td>{c.expEarned} EXP</td>
                    <td>{c.machineCompleted.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>{t('mystats.contest.noHistory')}</p>
        )
      )}
    </div>
  );
};

export default Progress;
