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
  
  // ✅ stage = 완료한 스테이지 개수
  // stage 0 → Playing Stage 1 (아무것도 완료 안 함)
  // stage 1 → Playing Stage 2 (Stage 1 완료)
  // stage 4 → All stages completed
  stage: { 
    type: Number, 
    default: 0 
  },
  
  completed: { 
    type: Boolean, 
    default: false 
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

  // 🃏 Hacker's Deck 모드용 카드 로그
  cardsUsed: [{
    name: String,
    cost: Number,       // ✅ 카드 비용 기록
    usedAt: Date
  }],

  // 🏰 Capture The Server 모드용
  serversCaptured: { 
    type: Number, 
    default: 0 
  },
  
  // ✅ 점령한 서버 목록
  capturedServers: [{
    serverId: String,
    capturedAt: Date,
    lostAt: { type: Date, default: null }  // null = 여전히 소유 중
  }],

  // ⚔️ Defense Battle 모드용
  teamName: { 
    type: String, 
    default: null 
  },
  
  // ✅ 팀 관련 추가
  teamRole: {
    type: String,
    enum: ['ATTACKER', 'DEFENDER', null],
    default: null
  },
  
  kills: { 
    type: Number, 
    default: 0 
  },
  
  deaths: { 
    type: Number, 
    default: 0 
  },
  
  // ✅ 공격/방어 액션 로그
  actions: [{
    actionType: String,   // 'attack', 'defend', 'heal', etc.
    actionName: String,   // 'SQL Injection', 'Enable Firewall', etc.
    damage: Number,       // 가한 피해
    heal: Number,         // 회복량
    timestamp: Date
  }]

}, { 
  timestamps: true 
});

// ✅ 복합 인덱스 추가 (쿼리 최적화)
ArenaProgressSchema.index({ arena: 1, user: 1 }, { unique: true });
ArenaProgressSchema.index({ arena: 1, score: -1 });  // 순위 정렬용

const ArenaProgress = mongoose.model('ArenaProgress', ArenaProgressSchema);
export default ArenaProgress;