import React from "react";
import { User } from "../../types/User";

type LeaderboardTableProps = {
  leaderboard: User[];
};

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ leaderboard }) => {
  return (
    <div className="leaderboard-table">
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
              <td>{u.username ?? u.username}</td>
              <td>{u.level}</td>
              <td>{u.exp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeaderboardTable;