// types/arenaScenarioData.ts

// ⚡ 1️⃣ Terminal Hacking Race 데이터 구조 (기존 유지)
export interface TerminalHackingRaceData {
  stages: {
    stage: number;
    prompt: string;
    commands: {
      command: string;
      args?: string[];
      response: string;
      progressDelta?: number;
      advanceStage?: boolean;
      flagFound?: boolean;
    }[];
    defaultResponse: string;
  }[];
  totalStages: number;
}

// ⚔️ 2️⃣ Cyber Defense Battle 데이터 구조 (기존 유지)
export interface CyberDefenseBattleData {
  serverHealth: number;
  attackActions: {
    name: string;
    damage: number;
    cost: number;
    cooldown: number;
    effect?: string;
  }[];
  defenseActions: {
    name: string;
    heal?: number;
    shield?: number;
    cost: number;
    cooldown: number;
    effect?: string;
  }[];
  victoryConditions: {
    attackTeam: string;
    defenseTeam: string;
  };
}

// 👑 3️⃣ King of the Hill 데이터 구조 - NEW
export interface KingOfTheHillData {
  serverInfo: {
    name: string;
    description: string;
    os: string;
    initialVulnerabilities: string[];
  };
  
  attackActions: {
    id: string;
    name: string;
    description: string;
    energyCost: number;
    successRate: number;  // % 단위
    effect: 'capture' | 'points';
    points?: number;
    cooldown: number;
  }[];
  
  defenseActions: {
    id: string;
    name: string;
    description: string;
    energyCost: number;
    effect: 'defenseLevel' | 'block';
    defenseBonus?: number;  // 방어 레벨 증가량
    blockChance?: number;   // 공격 차단 확률 증가 %
    cooldown: number;
  }[];
  
  scoring: {
    pointsPerSecond: number;  // 왕 상태 유지 시 초당 획득 점수
    firstCaptureBonus: number;
    fiveSecondBonus: number;
    oneMinuteBonus: number;
    captureBonus: number;  // 왕 탈환 성공 시
  };
  
  energySettings: {
    initial: number;
    regenRate: number;  // 초당
    maxEnergy: number;
  };
}

// 🔍 4️⃣ Forensics Rush 데이터 구조 - NEW
export interface ForensicsRushData {
  scenario: {
    title: string;
    description: string;
    incidentType: 'ransomware' | 'breach' | 'ddos' | 'insider' | 'phishing';
    date: string;
    context: string;
  };
  
  evidenceFiles: {
    id: string;
    name: string;
    type: 'log' | 'pcap' | 'memory' | 'filesystem' | 'image';
    path: string;
    description: string;
  }[];
  
  availableTools: string[];  // ['grep', 'wireshark', 'volatility', 'strings', 'tcpdump']
  
  questions: {
    id: string;
    question: string;
    type: 'text' | 'multiple-choice' | 'ip-address' | 'timestamp';
    answer: string | string[];  // 정답
    points: number;
    hints?: string[];
    relatedFiles: string[];  // 관련 증거 파일 ID
    difficulty: 'easy' | 'medium' | 'hard';
  }[];
  
  scoring: {
    wrongAnswerPenalty: number;  // -5점
    perfectScoreBonus: number;   // +50점
    speedBonus: boolean;          // 빠른 해결 시 보너스
  };
  
  totalQuestions: number;
}

// 💬 5️⃣ Social Engineering Challenge 데이터 구조 - NEW
export interface SocialEngineeringData {
  scenarioType: 'IT_HELPDESK' | 'FINANCE_SPEARPHISHING' | 'CEO_IMPERSONATION';
  
  objective: {
    title: string;
    description: string;
    targetInformation: string[];  // 획득해야 할 정보 목록
  };
  
  aiTarget: {
    name: string;
    role: string;
    department: string;
    personality: {
      helpfulness: number;      // 1-10
      securityAwareness: number;  // 1-10
      authorityRespect: number;   // 1-10
      skepticism: number;         // 1-10
    };
    suspicionThreshold: number;  // % (Easy: 70%, Medium: 50%, Hard: 30%)
    knownInfo: string[];  // AI가 알고 있는 정보
    secretInfo: string[];  // AI가 절대 공개하면 안 되는 정보
  };
  
  availableTechniques: {
    id: string;
    name: string;
    type: 'PRETEXTING' | 'AUTHORITY' | 'URGENCY' | 'RECIPROCITY' | 'LIKING';
    description: string;
    suspicionImpact: number;  // 의심도 증가량
    effectiveness: number;     // 효과도 (1-10)
  }[];
  
  conversationRules: {
    maxTurns: number;
    turnTimeLimit?: number;  // 선택적 턴 제한 시간
    warningThresholds: number[];  // 의심도 경고 레벨 [30, 60, 90]
  };
  
  scoring: {
    objectiveComplete: number;     // 100점
    turnEfficiency: {
      maxBonus: number;            // +50점
      optimalTurns: number;        // 최적 턴 수
    };
    suspicionManagement: {
      bonus: number;               // +30점
      threshold: number;           // 30% 이하 유지
    };
    naturalnessBonus: {
      maxPoints: number;           // +20점
      evaluationCriteria: string[];
    };
  };
  
  sampleDialogue?: {
    playerMessage: string;
    aiResponse: string;
    suspicionChange: number;
  }[];
}

// 통합 타입
export type ArenaScenarioData = 
  | TerminalHackingRaceData 
  | CyberDefenseBattleData
  | KingOfTheHillData
  | ForensicsRushData
  | SocialEngineeringData;

// 모드별 설정 헬퍼
export interface ModeConfiguration {
  mode: string;
  displayName: string;
  emoji: string;
  minPlayers: number;
  maxPlayers: number;
  defaultTime: number;  // 초
  difficulty: {
    EASY: { time: number; description: string };
    MEDIUM: { time: number; description: string };
    HARD: { time: number; description: string };
    EXPERT?: { time: number; description: string };
  };
}

export const MODE_CONFIGS: Record<string, ModeConfiguration> = {
  TERMINAL_HACKING_RACE: {
    mode: 'TERMINAL_HACKING_RACE',
    displayName: 'Terminal Hacking Race',
    emoji: '⚡',
    minPlayers: 2,
    maxPlayers: 8,
    defaultTime: 900,
    difficulty: {
      EASY: { time: 600, description: '명확한 취약점, 기본 명령어만 필요' },
      MEDIUM: { time: 900, description: '여러 단계, 중급 명령어 및 도구 필요' },
      HARD: { time: 1200, description: '복잡한 권한 상승, 고급 기술 요구' }
    }
  },
  CYBER_DEFENSE_BATTLE: {
    mode: 'CYBER_DEFENSE_BATTLE',
    displayName: 'Cyber Defense Battle',
    emoji: '⚔️',
    minPlayers: 2,
    maxPlayers: 2,
    defaultTime: 900,
    difficulty: {
      EASY: { time: 600, description: '기본 공격/방어 액션, 느린 페이스' },
      MEDIUM: { time: 900, description: '다양한 액션, 전략 필요' },
      HARD: { time: 1500, description: '복잡한 액션 조합, 고급 전략' }
    }
  },
  KING_OF_THE_HILL: {
    mode: 'KING_OF_THE_HILL',
    displayName: 'King of the Hill',
    emoji: '👑',
    minPlayers: 2,
    maxPlayers: 8,
    defaultTime: 900,
    difficulty: {
      EASY: { time: 600, description: '간단한 공격/방어, 높은 성공률' },
      MEDIUM: { time: 900, description: '균형잡힌 난이도, 전략 중요' },
      HARD: { time: 900, description: '낮은 성공률, 고급 전략 필수' }
    }
  },
  FORENSICS_RUSH: {
    mode: 'FORENSICS_RUSH',
    displayName: 'Forensics Rush',
    emoji: '🔍',
    minPlayers: 2,
    maxPlayers: 8,
    defaultTime: 900,
    difficulty: {
      EASY: { time: 600, description: '명확한 로그, 간단한 공격 패턴' },
      MEDIUM: { time: 900, description: '여러 로그 파일 교차 분석 필요' },
      HARD: { time: 900, description: '로그 조작, 암호화, 안티 포렌식 기법 포함' }
    }
  },
  SOCIAL_ENGINEERING_CHALLENGE: {
    mode: 'SOCIAL_ENGINEERING_CHALLENGE',
    displayName: 'Social Engineering Challenge',
    emoji: '💬',
    minPlayers: 1,
    maxPlayers: 4,
    defaultTime: 600,
    difficulty: {
      EASY: { time: 300, description: 'AI 친절, 낮은 보안 인식 (의심 한계 70%)' },
      MEDIUM: { time: 600, description: 'AI 조심스러움, 중간 보안 인식 (의심 한계 50%)' },
      HARD: { time: 600, description: 'AI 매우 경계, 높은 보안 인식 (의심 한계 30%)' }
    }
  }
};