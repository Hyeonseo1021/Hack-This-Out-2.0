import { Machine, Contest } from "./Contest";
import { User } from "./User";

export type UserProgress = {
    userProgress: UserProgressItem[];
};

export type UserProgressItem = {
    _id: number;
    user: User;
    machine: Machine;
    completed: boolean;
    completedAt?: Date;
    usedHints: string[];
    remainingHints: number;
    hintsUsed: number;
    expEarned: number;
    timeSpent: Date;
};

export type ContestParticipation = {
    contestParticipation: ContestParticipationItem[];
};

export type ContestParticipationItem = {
    _id: number;
    user: User;
    contest: Contest;
    participationStartTime: Date;
    participationEndTime?: Date;
    hintsUsed: number;
    expEarned: number;
    machineCompleted: Machine[];
    contestCompleted: boolean;
};

// src/types/Progress.ts
export interface ArenaHistoryItem {
  _id: string;
  name: string; // 아레나 이름
  mode: string; // ex: 'Terminal Race', 'Defense Battle', etc.
  host?: {
    _id: string;
    username: string;
  };
  startTime?: string;
  endTime: string;
  status?: 'waiting' | 'started' | 'ended';
  winner: {
    _id: string;
    username: string;
  } | null;
  participants: {
    user: {
      _id: string;
      username: string;
    };
    rank: number;
    expEarned: number;
    flagCorrect?: boolean;
    score: number;
    stage?: number;
  }[];
  arenaExp?: number;
  myExpEarned: number;  // ✨ 내가 획득한 경험치
  myRank?: number;
  myScore?: number;
  myCompleted?: boolean;
}
