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
    personalEndTime: { type: Date, default: null }, // 개인별 종료 시간 (시간 연장 아이템용)
    progress: {
      score: { type: Number, default: 0 },
      stage: { type: Number, default: 1 },
      flagSubmitted: { type: Boolean, default: false },
      flagTime: { type: Date, default: null }
    },
    activeBuffs: [{
      type: { type: String, enum: ['score_boost', 'invincible'] },
      value: Number,
      startedAt: Date,
      expiresAt: Date
    }]
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
      'TERMINAL_HACKING_RACE',           // ⚡ 명령어 기반 속도 경쟁 (2-8명)
      'VULNERABILITY_SCANNER_RACE',      // 🔍 웹 취약점 스캔 경쟁 (2명) - NEW
      'FORENSICS_RUSH',                  // 🔎 포렌식 분석 경쟁 (2-8명)
      'SOCIAL_ENGINEERING_CHALLENGE'     // 💬 사회공학 심리전 (1-4명)
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
    // ⚡ Terminal Hacking Race 설정
    terminalRace: {
      commandLimit: { type: Number, default: 50 } // 최대 명령어 수
    },
    
    // 🔍 Vulnerability Scanner Race 설정 - NEW
    vulnerabilityScannerRace: {
      totalVulnerabilities: { type: Number, default: 7 },  // 총 취약점 개수
      mode: {
        type: String,
        enum: ['SIMULATED', 'REAL'],  // SIMULATED: Claude 생성 HTML, REAL: 실제 웹
        default: 'SIMULATED'
      },
      vulnerableHTML: { type: String, default: '' },  // Claude가 생성한 HTML (EASY/MEDIUM)
      vulnerabilities: [{
        vulnId: String,           // 취약점 고유 ID
        vulnType: String,         // 'SQLi', 'XSS', 'IDOR', etc.
        flag: String,             // FLAG{...} - exploit 성공 시 노출되는 플래그
        basePoints: Number,       // 기본 점수
        difficulty: String,       // 'EASY', 'MEDIUM', 'HARD'
        discovered: [{
          user: mongoose.Schema.Types.ObjectId,
          discoveredAt: Date,
          isFirstBlood: Boolean,
          pointsAwarded: Number
        }]
      }],
      targetUrl: String,          // 타겟 웹 애플리케이션 URL (HARD/EXPERT)
      targetName: {               // 타겟 이름 (다국어)
        ko: String,
        en: String
      },
      targetDescription: {        // 타겟 설명 (다국어)
        ko: String,
        en: String
      },
      hints: [{
        vulnId: String,
        hintLevel: Number,        // 1, 2, 3
        hintText: String,
        cost: Number              // 힌트 비용 (점수 차감)
      }]
    },

    // 🔎 Forensics Rush 설정
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
    
    // 💬 Social Engineering Challenge 설정
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
    endOnFirstSolve: { type: Boolean, default: false },  // Scanner Race는 false (모든 취약점 발견 또는 시간 종료)
    graceMs: { type: Number, default: 90_000 },
  }

}, {
  timestamps: true
});

const Arena = mongoose.model('Arena', ArenaSchema);
export default Arena;