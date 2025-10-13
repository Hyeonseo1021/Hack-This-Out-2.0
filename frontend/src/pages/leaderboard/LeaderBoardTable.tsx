import React, { useState } from "react";
import { User } from "../../types/User";

type LeaderboardTableProps = {
  leaderboard: User[];
};

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ leaderboard }) => {
  // 화면 전환 상태 (false: 첫 화면, true: 전체 리더보드)
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`leaderboard-container ${expanded ? "second-screen" : "first-screen"}`}
      onClick={() => setExpanded(!expanded)} // 클릭 시 화면 전환
    >
      {/* ====== 첫 번째 화면 : Top 3 카드 ====== */}
      {!expanded && (
        <div className="top-three">
          {leaderboard.slice(0, 3).map((u, idx) => (
            <div className="rank-card" key={u._id ?? idx}>
              <h2>{idx + 1}위</h2>
              <p>{u.username}</p>
              <p>Lv. {u.level}</p>
              <p>EXP: {u.exp}</p>
            </div>
          ))}
        </div>
      )}

      {/* ====== 두 번째 화면 : 전체 리더보드 ====== */}
      {expanded && (
        <div className="expanded-view">
          <h2 className="leaderboard-title">전체 리더보드</h2>
          <table>
            <thead>
              <tr>
                <th>순위</th>
                <th>닉네임</th>
                <th>레벨</th>
                <th>EXP</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((u, idx) => (
                <tr key={u._id ?? idx}>
                  <td>{idx + 1}</td>
                  <td>{u.username}</td>
                  <td>{u.level}</td>
                  <td>{u.exp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaderboardTable;