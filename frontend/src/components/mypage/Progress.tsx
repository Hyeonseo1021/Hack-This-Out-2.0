import { useEffect, useState } from "react";
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
      <h2>History</h2>
      <div className="tabs">
        <button className={`tab-button ${activeTab === "machine" ? "active" : ""}`} onClick={() => setActiveTab("machine")}>
          Machine
        </button>
        <button className={`tab-button ${activeTab === "contest" ? "active" : ""}`} onClick={() => setActiveTab("contest")}>
          Contest
        </button>
        <button className={`tab-button ${activeTab === "arena" ? "active" : ""}`} onClick={() => setActiveTab("arena")}>
          Arena
        </button>
      </div>

      {/* ✅ Arena History 추가 */}
      {activeTab === "arena" ? (
        arenaHistory.length > 0 ? (
          <table className="arena-table">
            <thead>
              <tr className="head-detail">
                <th className="head-name">Arena Name</th>
                <th className="head-category">Mode</th>
                <th className="head-time">End Time</th>
                <th className="head-winner">Winner</th>
                <th className="head-exp">EXP</th>
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
                    <td className="body-exp">{arena.arenaExp} EXP</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>No arena history available.</p>
        )
      ) : activeTab === "machine" ? (
        // 기존 Machine 탭 유지
        userProgress.length > 0 ? (
          <table className="progress-table">
            <thead>
              <tr className="head-detail">
                <th>Machine Name</th>
                <th>EXP</th>
                <th>Time</th>
                <th>Hints Used</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {userProgress.map((p) => (
                <tr key={p._id}>
                  <td>{p.machine?.name || "Unknown"}</td>
                  <td>{p.expEarned} EXP</td>
                  <td>{formatTimeSpent(new Date(p.timeSpent))}</td>
                  <td>{p.hintsUsed}</td>
                  <td>{p.completedAt ? formatDate(p.completedAt) : "Not completed"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No machine history.</p>
        )
      ) : (
        // Contest 탭
        contestParticipation.length > 0 ? (
          <table className="contest-table">
            <thead>
              <tr>
                <th>Contest Name</th>
                <th>Start</th>
                <th>End</th>
                <th>EXP</th>
                <th>Machines</th>
              </tr>
            </thead>
            <tbody>
              {contestParticipation.map((c) => (
                <tr key={c._id}>
                  <td>{c.contest.name}</td>
                  <td>{formatDate(c.participationStartTime)}</td>
                  <td>{c.participationEndTime ? formatDate(c.participationEndTime) : "Ongoing"}</td>
                  <td>{c.expEarned} EXP</td>
                  <td>{c.machineCompleted.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No contest history.</p>
        )
      )}
    </div>
  );
};

export default Progress;
