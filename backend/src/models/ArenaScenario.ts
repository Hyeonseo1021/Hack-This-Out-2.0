// models/ArenaScenario.ts
import mongoose, { Schema, Document } from 'mongoose';

export type ArenaMode = 
  | 'TERMINAL_HACKING_RACE'           // ⚡ 명령어 기반 속도 경쟁
  | 'VULNERABILITY_SCANNER_RACE'      // 🔍 웹 취약점 스캔 경쟁 - NEW
  | 'FORENSICS_RUSH'                  // 🔎 포렌식 분석 경쟁
  | 'SOCIAL_ENGINEERING_CHALLENGE';   // 💬 사회공학 심리전

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

const ArenaScenarioSchema = new Schema({
  mode: {
    type: String,
    enum: [
      'TERMINAL_HACKING_RACE',           // ⚡ 명령어 기반 속도 경쟁
      'VULNERABILITY_SCANNER_RACE',      // 🔍 웹 취약점 스캔 경쟁 - NEW
      'FORENSICS_RUSH',                  // 🔎 포렌식 분석 경쟁
      'SOCIAL_ENGINEERING_CHALLENGE'     // 💬 사회공학 심리전
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
    default: 600  // 10분
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
ArenaScenarioSchema.index({ mode: 1, difficulty: 1, isActive: 1 });

export default mongoose.model<IArenaScenario>('ArenaScenario', ArenaScenarioSchema);