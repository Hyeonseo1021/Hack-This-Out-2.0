import mongoose from 'mongoose';

const ArenaProgressSchema = new mongoose.Schema({
  arena: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Arena',
    required: true,
    index: true  // ✅ 쿼리 성능 향상
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true  // ✅ 쿼리 성능 향상
  },

  // 💯 기본 점수 및 진행
  score: { 
    type: Number, 
    default: 0 
  },
  
  stage: { 
    type: Number, 
    default: 0 
  },
  
  completed: { 
    type: Boolean, 
    default: false 
  },
  
  // ✅ 게임 완료 시각 (정확한 완료 시간 기록)
  submittedAt: {
    type: Date,
    default: null
  },
  
  // ✅ 완료까지 걸린 시간 (초 단위, startTime부터 submittedAt까지)
  completionTime: {
    type: Number,
    default: null
  },
  
  timeSpent: { 
    type: Number, 
    default: 0 
  }, // ms 단위

  // 🏁 제출 로그 (Terminal Hacking Race에서 사용)
  flags: [{
    stage: Number,       // ✅ 어떤 스테이지에서 제출했는지
    correct: Boolean,    // ✅ 정답 여부
    submittedAt: Date
  }],

  // ✅ 경험치 보상 (게임 종료 시 계산)
  expEarned: {
    type: Number,
    default: 0
  },

  // 💰 HTO 코인 보상 (게임 종료 시 계산)
  coinsEarned: {
    type: Number,
    default: 0
  },

  // 🎮 Terminal Hacking Race 전용
  terminalRace: {
    timeBonusPoints: { type: Number, default: 0 },      // 시간 보너스 점수
    commandsExecuted: { type: Number, default: 0 },     // 실행한 명령어 수
    hintsUsed: { type: Number, default: 0 }             // 사용한 힌트 개수
  },

  // 🔍 Vulnerability Scanner Race 전용 - NEW
  vulnerabilityScannerRace: {
    vulnerabilitiesFound: { type: Number, default: 0 },  // 발견한 취약점 개수
    firstBloods: { type: Number, default: 0 },           // First Blood 개수
    invalidSubmissions: { type: Number, default: 0 },    // 잘못된 제출 횟수
    hintsUsed: { type: Number, default: 0 },            // 사용한 힌트 개수
    speedBonusPoints: { type: Number, default: 0 },     // 속도 보너스 점수
    comboPoints: { type: Number, default: 0 },          // 콤보 보너스 점수
    timeBonusPoints: { type: Number, default: 0 },      // 시간 보너스 점수
    discoveries: [{
      vulnId: String,              // 취약점 ID
      vulnType: String,            // 취약점 타입
      endpoint: String,            // 엔드포인트
      payload: String,             // 사용한 페이로드
      discoveredAt: Date,          // 발견 시각
      isFirstBlood: Boolean,       // First Blood 여부
      basePoints: Number,          // 기본 점수
      speedBonus: Number,          // 속도 보너스
      comboBonus: Number,          // 콤보 보너스
      totalPoints: Number          // 총 획득 점수
    }],
    submissions: [{
      vulnType: String,
      endpoint: String,
      parameter: String,
      payload: String,
      isCorrect: Boolean,
      pointsChange: Number,        // +점수 또는 -점수 (페널티)
      submittedAt: Date
    }]
  },

  // 🔎 Forensics Rush 전용
  forensicsRush: {
    questionsAnswered: { type: Number, default: 0 },
    questionsCorrect: { type: Number, default: 0 },
    totalAttempts: { type: Number, default: 0 },
    penalties: { type: Number, default: 0 },  // 오답 페널티 점수
    perfectScore: { type: Boolean, default: false },  // 10문제 전부 정답
    answers: [{
      questionId: String,
      answer: String,
      correct: Boolean,
      attempts: { type: Number, default: 1 },
      answeredAt: Date,
      points: Number
    }]
  },

  // 💬 Social Engineering Challenge 전용
  socialEngineering: {
    objectiveAchieved: { type: Boolean, default: false },
    finalSuspicion: { type: Number, default: 0 },
    turnsUsed: { type: Number, default: 0 },
    blocked: { type: Boolean, default: false },  // 의심도 100% 도달로 차단됨
    techniquesUsed: [{
      technique: String,  // 'PRETEXTING', 'AUTHORITY', 'URGENCY', etc.
      message: String,
      suspicionDelta: Number,
      timestamp: Date
    }],
    naturalness: { type: Number, default: 0 },  // AI 평가 점수 (0-20점)
    conversation: [{
      from: { type: String, enum: ['PLAYER', 'AI'] },
      message: String,
      suspicionBefore: Number,
      suspicionAfter: Number,
      timestamp: Date
    }]
  }

}, { 
  timestamps: true 
});

// ✅ 복합 인덱스 추가 (쿼리 최적화)
ArenaProgressSchema.index({ arena: 1, user: 1 }, { unique: true });
ArenaProgressSchema.index({ arena: 1, score: -1 });  // 순위 정렬용

const ArenaProgress = mongoose.model('ArenaProgress', ArenaProgressSchema);
export default ArenaProgress;