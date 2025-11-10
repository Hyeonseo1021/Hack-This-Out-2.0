import mongoose from 'mongoose';

const ArenaProgressSchema = new mongoose.Schema({
  arena: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Arena',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // 💯 기본 점수 및 진행
  score: { type: Number, default: 0 },
  stage: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  timeSpent: { type: Number, default: 0 }, // ms 단위

  // 🏁 제출 로그
  flags: [{
    stage: Number,
    correct: Boolean,
    submittedAt: Date
  }],

  // 🃏 Hacker’s Deck 모드용 카드 로그
  cardsUsed: [{
    name: String,
    usedAt: Date
  }],

  // 🏰 Capture Server 모드용
  serversCaptured: { type: Number, default: 0 },

  // ⚔️ Defense Battle 모드용
  teamName: { type: String, default: null },
  kills: { type: Number, default: 0 },
  deaths: { type: Number, default: 0 }

}, { timestamps: true });

const ArenaProgress = mongoose.model('ArenaProgress', ArenaProgressSchema);
export default ArenaProgress;
