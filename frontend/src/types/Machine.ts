/**
 * Interface representing difficulty information.
 */
export interface Difficulty {
  creatorLevel: string;
  confirmedLevel?: string;
  isConfirmed: boolean;
  reviewCount: number;
}

/**
 * Interface representing the details of a machine.
 */
export interface MachineDetail {
  _id: string;
  name: string;
  category: string;
  description?: string;
  exp: number;
  amiId?: string;
  rating: number;
  difficulty?: Difficulty;  // 추가
  // Add other relevant fields as necessary
}

export interface Review {
  _id: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  difficulty: string;  // 추가
  content: string;
  createdAt: string;
}

export interface MachineforBanner {
  _id: string;
  name: string;
  category: string;
  exp: number;
  rating: number;
  playerCount: number;
  isActive: boolean;
  createdAt: string;
  difficulty?: Difficulty;  // 추가 (배너에도 난이도 표시하려면)
}