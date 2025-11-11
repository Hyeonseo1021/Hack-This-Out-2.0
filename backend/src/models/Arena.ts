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
    min: 2,
    max: 8
  },

  mode: {
    type: String,
    enum: [
      'TERMINAL_HACKING_RACE',     
      'CYBER_DEFENSE_BATTLE',
      'CAPTURE_THE_SERVER',
      'HACKERS_DECK',
      'EXPLOIT_CHAIN_CHALLENGE'
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
    terminalRace: {
      commandLimit: { type: Number, default: 50 } // 최대 명령어 수
    },
    defenseBattle: {
      teams: [{
        name: String,
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        score: { type: Number, default: 0 }
      }]
    },
    captureServer: {
      servers: [{ team: String, count: Number }]
    },
    hackersDeck: {
      deckSize: { type: Number, default: 10 },
      turnTimeLimit: { type: Number, default: 30 }
    },
    exploitChain: {
      totalStages: { type: Number, default: 5 },
      currentStage: { type: Number, default: 1 }
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
