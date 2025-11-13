import mongoose from 'mongoose';

const ArenaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 30,
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isReady: { type: Boolean, default: false },
    hasLeft: { type: Boolean, default: false },
    progress: {
      score: { type: Number, default: 0 },
      stage: { type: Number, default: 1 },
      flagSubmitted: { type: Boolean, default: false },
      flagTime: { type: Date, default: null }
    }
  }],
  maxParticipants: {
    type: Number,
    default: 2,
    min: 1,  // Social Engineering은 1명부터 가능
    max: 8
  },

  mode: {
    type: String,
    enum: [
      'TERMINAL_HACKING_RACE',      // ⚡ 명령어 기반 속도 경쟁 (2-8명) - 기존 유지
      'CYBER_DEFENSE_BATTLE',        // ⚔️ 공격팀 vs 방어팀 - 기존 유지
      'KING_OF_THE_HILL',            // 👑 점령 전쟁 (2-8명) - NEW
      'FORENSICS_RUSH',              // 🔍 포렌식 분석 경쟁 (2-8명) - NEW
      'SOCIAL_ENGINEERING_CHALLENGE' // 💬 사회공학 심리전 (1-4명) - NEW
    ],
    required: true
  },

  difficulty: {
    type: String,
    enum: ['EASY', 'MEDIUM', 'HARD', 'EXPERT'],
    required: true
  },

  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ArenaScenario',
    required: true
  },

  timeLimit: {
    type: Number,
    required: true
  },

  modeSettings: {
    // ⚡ Terminal Hacking Race 설정 (기존 유지)
    terminalRace: {
      commandLimit: { type: Number, default: 50 } // 최대 명령어 수
    },
    
    // ⚔️ Cyber Defense Battle 설정 (1v1 매치)
    defenseBattle: {
      attacker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      defender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      serverHealth: { type: Number, default: 100 },
      attackerEnergy: { type: Number, default: 100 },
      defenderEnergy: { type: Number, default: 100 },
      actionLog: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['ATTACKER', 'DEFENDER'] },
        actionName: String,
        energyCost: Number,
        damage: Number,
        heal: Number,
        timestamp: Date
      }]
    },
    
    // 👑 King of the Hill 설정 - NEW
    kingOfTheHill: {
      currentKing: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      kingCrownedAt: { type: Date, default: null },
      defenseLevel: { type: Number, default: 0 },
      kingChanges: [{
        previousKing: mongoose.Schema.Types.ObjectId,
        newKing: mongoose.Schema.Types.ObjectId,
        timestamp: Date
      }],
      playerScores: [{
        user: mongoose.Schema.Types.ObjectId,
        kingDuration: { type: Number, default: 0 }, // 초 단위
        lastKingTime: { type: Number, default: 0 }
      }]
    },
    
    // 🔍 Forensics Rush 설정 - NEW
    forensicsRush: {
      questions: [{
        questionId: String,
        question: String,
        points: Number,
        answered: [{ 
          user: mongoose.Schema.Types.ObjectId, 
          correct: Boolean, 
          attempts: Number,
          answeredAt: Date 
        }]
      }],
      evidenceFiles: [String],  // 제공되는 증거 파일 목록
      tools: [String]  // 사용 가능한 도구 목록
    },
    
    // 💬 Social Engineering Challenge 설정 - NEW
    socialEngineering: {
      scenarioType: { 
        type: String, 
        enum: ['IT_HELPDESK', 'FINANCE_SPEARPHISHING', 'CEO_IMPERSONATION']
      },
      targetInfo: {
        name: String,
        role: String,
        suspicionThreshold: Number  // Easy: 70%, Medium: 50%, Hard: 30%
      },
      conversations: [{
        user: mongoose.Schema.Types.ObjectId,
        messages: [{
          from: { type: String, enum: ['PLAYER', 'AI'] },
          message: String,
          suspicionDelta: Number,
          timestamp: Date
        }],
        currentSuspicion: { type: Number, default: 0 },
        objectiveAchieved: { type: Boolean, default: false },
        blocked: { type: Boolean, default: false }
      }]
    }
  },

  startTime: { type: Date, required: false },
  endTime: { type: Date, required: false },

  status: {
    type: String,
    enum: ['waiting', 'started', 'ended'],
    default: 'waiting'
  },

  submissions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedAt: Date,
    flagCorrect: Boolean
  }],

  ranking: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rank: Number
  }],

  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  firstSolvedAt: { type: Date, default: null },

  arenaExp: { type: Number, default: 50 },

  settings: {
    endOnFirstSolve: { type: Boolean, default: true },
    graceMs: { type: Number, default: 90_000 },
  }

}, {
  timestamps: true
});

const Arena = mongoose.model('Arena', ArenaSchema);
export default Arena;