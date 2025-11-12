// models/GameScenario.ts
import mongoose, { Schema, Document } from 'mongoose';

export type ArenaMode = 
  | 'TERMINAL_HACKING_RACE'
  | 'CYBER_DEFENSE_BATTLE'
  | 'CAPTURE_THE_SERVER'
  | 'HACKERS_DECK'
  | 'EXPLOIT_CHAIN_CHALLENGE';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

interface IArenaScenario extends Document {
  mode: ArenaMode;
  difficulty: Difficulty;
  title: string;
  description: string;
  timeLimit: number;
  
  // 모드별 데이터
  data: any;
  
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
}

const ArenaScenarioScema = new Schema({
  mode: {
    type: String,
    enum: [
      'TERMINAL_HACKING_RACE',      // ⚡ 명령어 기반 속도 경쟁
      'CYBER_DEFENSE_BATTLE',        // ⚔️ 공격팀 vs 방어팀
      'CAPTURE_THE_SERVER',          // 🏰 서버 점령 전략전
      'HACKERS_DECK',                // 🎲 카드 전략 턴제
      'EXPLOIT_CHAIN_CHALLENGE'      // 🎯 단계별 퍼즐형
    ],
    required: true,
    index: true
  },
  difficulty: {
    type: String,
    enum: ['EASY', 'MEDIUM', 'HARD', 'EXPERT'],
    required: true,
    index: true
  },
  title: { 
    type: String, 
    required: true 
  },
  description: String,
  timeLimit: { 
    type: Number, 
    default: 600 
  },
  
  // 모드별 데이터를 유연하게 저장
  data: { 
    type: Schema.Types.Mixed, 
    required: true 
  },
  
  isActive: { 
    type: Boolean, 
    default: true 
  },
  usageCount: { 
    type: Number, 
    default: 0 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// 복합 인덱스
ArenaScenarioScema.index({ mode: 1, difficulty: 1, isActive: 1 });

export default mongoose.model<IArenaScenario>('ArenaScenario', ArenaScenarioScema);