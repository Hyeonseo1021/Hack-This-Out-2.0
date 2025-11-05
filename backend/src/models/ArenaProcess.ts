import mongoose from "mongoose";

const ArenaProcessSchema = new mongoose.Schema({
  arenaId: { type: mongoose.Schema.Types.ObjectId, ref: "Arena", required: true },

  // 기본 메타데이터
  name: { type: String, required: true },
  category: {
    type: String,
    enum: ["Web", "Network", "Database", "Crypto", "Cloud", "AI", "OS", "Random"],
    required: true,
  },
  machine: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", required: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // 경기 시간 관련
  startTime: { type: Date },
  endTime: { type: Date },
  duration: { type: Number, default: 10 },

  // 참가자 요약
  participants: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      vpnIp: String,
      status: {
        type: String,
        enum: ["waiting", "vm_connected", "flag_submitted", "completed"],
        default: "waiting",
      },
      rank: Number,
      expEarned: Number,
      submittedAt: Date,
      flagCorrect: Boolean,
    },
  ],

  // 최종 결과
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  firstSolvedAt: { type: Date, default: null },
  ranking: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rank: Number,
    },
  ],

  // Arena 환경
  settings: {
    endOnFirstSolve: { type: Boolean, default: true },
    graceMs: { type: Number, default: 90_000 },
    hardTimeLimitMs: { type: Number, default: 10 * 60_000 },
  },

  // 경험치/보상 요약
  arenaExp: { type: Number, default: 50 },
}, {
  timestamps: true,
});

export default mongoose.model("ArenaProcess", ArenaProcessSchema);
