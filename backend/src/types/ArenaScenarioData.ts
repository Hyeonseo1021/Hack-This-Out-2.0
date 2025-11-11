// types/arenaScenarioData.ts

// 1️⃣ Terminal Hacking Race 데이터 구조
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

// 2️⃣ Cyber Defense Battle 데이터 구조
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

// 3️⃣ Capture The Server 데이터 구조
export interface CaptureTheServerData {
  servers: {
    id: string;
    type: 'web' | 'database' | 'ssh' | 'mail' | 'dns' | 'api' | 'ftp' | 'proxy';
    vulnerability: string;
    captureTime: number;
    points: number;
    specialAbility: string;
  }[];
  mapLayout: {
    rows: number;
    cols: number;
  };
}

// 4️⃣ Hacker's Deck 데이터 구조
export interface HackersDeckData {
  deck: {
    attack: {
      name: string;
      cost: number;
      damage?: number;
      effect?: string;
    }[];
    defense: {
      name: string;
      cost: number;
      shield?: number;
      heal?: number;
      effect?: string;
    }[];
    special: {
      name: string;
      cost: number;
      effect: string;
    }[];
  };
  startingHand: number;
  startingEnergy: number;
  maxTurns: number;
  victoryCondition: string;
}

// 5️⃣ Exploit Chain Challenge 데이터 구조
export interface ExploitChainChallengeData {
  missionBrief: {
    target: string;
    goal: string;
    constraint: string;
  };
  steps: {
    stage: string;
    question: string;
    options: string[];
    correct: string;
    explanation: string;
    points: number;
  }[];
  hintsAvailable: number;
  hintPenalty: number;
}