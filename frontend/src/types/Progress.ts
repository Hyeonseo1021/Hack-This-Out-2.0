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

export interface ArenaHistoryItem {
  _id: string;
  name: string;
  category: string;
  machine: {
    _id: string;
    name: string;
  };
  host: string;
  startTime: string;
  endTime: string;
  winner: {
    _id: string;
    username: string;
  } | null;
  participants: {
    user: string;
    rank: number;
    expEarned: number;
    flagCorrect: boolean;
  }[];
  arenaExp: number;
}
