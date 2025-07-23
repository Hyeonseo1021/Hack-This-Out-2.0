import mongoose from 'mongoose';

const DuelMachineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  flag: {
    type: String,
    required: true
  },
  amiId: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['Web', 'Network', 'Database', 'Crypto', 'Cloud', 'AI', 'OS', 'Other'],
    required: true
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  weight: {
    type: Number,
    default: 1
  },
  minTier: {
    type: Number,
    default: 0
  },
  maxTier: {
    type: Number,
    default: 5000
  }
}, { 
    timestamps: true
});

const DuelMachine = mongoose.model('DuelMachine', DuelMachineSchema);

export default DuelMachine;
