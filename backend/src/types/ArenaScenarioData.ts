// types/arenaScenarioData.ts

export interface TerminalHackingRaceData {
  stages: {
    stage: number;
    prompt: {
      ko: string;
      en: string;
    };
    commands: {
      command: string;
      args?: string[];
      response: {
        ko: string;
        en: string;
      };
      progressDelta?: number;
      advanceStage?: boolean;
      flagFound?: boolean;
    }[];
    defaultResponse: {
      ko: string;
      en: string;
    };
  }[];
  totalStages: number;
}

export interface VulnerabilityScannerRaceData {
  mode: 'SIMULATED' | 'REAL';           // SIMULATED: AI 생성 HTML, REAL: 실제 URL
  targetUrl: string;                     // SIMULATED일 때는 내부 URL, REAL일 때는 실제 URL
  targetName: {                          // 대상 이름 (다국어)
    ko: string;
    en: string;
  };
  targetDescription: {                   // 대상 설명 (다국어)
    ko: string;
    en: string;
  };

  features: string[];                    // AI가 생성할 기능들 (SIMULATED 모드)

  vulnerabilities: {
    vulnId: string;                      // 고유 ID
    vulnType: VulnType;                  // 취약점 타입
    vulnName: string | {                 // 취약점 이름 (단일 문자열 또는 다국어 객체)
      ko: string;
      en: string;
    };
    flag: string;                        // FLAG (예: "FLAG{sql_injection_success}")
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    basePoints: number;
    category: string;
    hintIds?: string[];

    // 🆕 Exploit 설정 (시나리오별 커스텀 가능)
    exploitPatterns?: string[];          // exploit 감지 패턴 (예: ["' OR", "1=1", "admin'--"])
    targetField?: string;                // exploit 대상 필드 (예: "username", "search", "file")
    location?: string | {                // 취약점 위치 설명 (REAL 모드에서 유저 안내용)
      ko: string;
      en: string;
    };
  }[];

  hints?: {
    hintId: string;
    vulnId: string;
    level: 1 | 2 | 3;
    text: string;                        // 힌트 텍스트 (단일 문자열)
    cost: number;                        // 힌트 사용 비용 (점수 차감)
  }[];

  scoring: {
    invalidSubmissionPenalty: number;
  };

  totalVulnerabilities: number;
}

// 취약점 타입 정의
export type VulnType = 
  | 'SQLi'                             
  | 'XSS'                               
  | 'IDOR'                         
  | 'PATH_TRAVERSAL'                 
  | 'CSRF'                              
  | 'COMMAND_INJECTION'                
  | 'FILE_UPLOAD'                       
  | 'AUTH_BYPASS'                      
  | 'INFO_DISCLOSURE'                  
  | 'XXE'                               
  | 'SSRF'                             
  | 'DESERIALIZATION';                  

export interface ForensicsRushData {
  scenario: {
    title: string | {              // 시나리오 제목 (다국어 지원)
      ko: string;
      en: string;
    };
    description: string | {        // 시나리오 설명 (다국어 지원)
      ko: string;
      en: string;
    };
    incidentType: 'ransomware' | 'breach' | 'ddos' | 'insider' | 'phishing';
    date: string;
    context: string | {            // 배경 설명 (다국어 지원)
      ko: string;
      en: string;
    };
  };

  evidenceFiles: {
    id: string;
    name: string;
    type: 'log' | 'pcap' | 'memory' | 'filesystem' | 'image';
    path: string;
    description: string | {        // 증거 파일 설명 (다국어 지원)
      ko: string;
      en: string;
    };
    content?: string;
  }[];

  availableTools: string[];

  questions: {
    id: string;
    question: string | {           // 질문 (다국어 지원)
      ko: string;
      en: string;
    };
    type: 'text' | 'multiple-choice' | 'ip-address' | 'timestamp';
    answer: string | string[];
    points: number;
    hints?: string[] | {           // 힌트 (다국어 지원)
      ko: string[];
      en: string[];
    };
    relatedFiles: string[];
    difficulty: 'easy' | 'medium' | 'hard';
  }[];

  scoring: {
    wrongAnswerPenalty: number;
    perfectScoreBonus: number;
    speedBonus: boolean;
  };

  totalQuestions: number;
}

export interface SocialEngineeringData {
  scenarioType: string;            // 시나리오 타입 (자유 입력 또는 프리셋)

  objective: {
    title: string | {              // 목표 제목 (다국어 지원)
      ko: string;
      en: string;
    };
    description: string | {        // 목표 설명 (다국어 지원)
      ko: string;
      en: string;
    };
    targetInformation: string[];
  };

  aiTarget: {
    name: string;
    role: string;
    department: string;
    personality: {
      helpfulness: number;
      securityAwareness: number;
      authorityRespect: number;
      skepticism: number;
    };
    suspicionThreshold: number;
    knownInfo: string[];
    secretInfo: string[];
  };

  availableTechniques: {
    id: string;
    name: string | {               // 기법 이름 (다국어 지원)
      ko: string;
      en: string;
    };
    type: 'PRETEXTING' | 'AUTHORITY' | 'URGENCY' | 'RECIPROCITY' | 'LIKING';
    description: string | {        // 기법 설명 (다국어 지원)
      ko: string;
      en: string;
    };
    suspicionImpact: number;
    effectiveness: number;
  }[];

  conversationRules: {
    maxTurns: number;
    turnTimeLimit?: number;
    warningThresholds: number[];
  };

  scoring: {
    objectiveComplete: number;
    turnEfficiency: {
      maxBonus: number;
      optimalTurns: number;
    };
    suspicionManagement: {
      bonus: number;
      threshold: number;
    };
    naturalnessBonus: {
      maxPoints: number;
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
  | VulnerabilityScannerRaceData         
  | ForensicsRushData
  | SocialEngineeringData;

// 모드별 설정 헬퍼
export interface ModeConfiguration {
  mode: string;
  displayName: string;
  emoji: string;
  minPlayers: number;
  maxPlayers: number;
  defaultTime: number; 
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
  VULNERABILITY_SCANNER_RACE: {
    mode: 'VULNERABILITY_SCANNER_RACE',
    displayName: 'Vulnerability Scanner Race',
    emoji: '🔍',
    minPlayers: 2,
    maxPlayers: 2,
    defaultTime: 600,
    difficulty: {
      EASY: { time: 600, description: '쉬운 취약점 (SQLi, XSS)' },
      MEDIUM: { time: 600, description: '중급 취약점 (IDOR, CSRF)' },
      HARD: { time: 600, description: '고급 취약점 (Command Injection, XXE)' }
    }
  },
  FORENSICS_RUSH: {
    mode: 'FORENSICS_RUSH',
    displayName: 'Forensics Rush',
    emoji: '🔎',
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