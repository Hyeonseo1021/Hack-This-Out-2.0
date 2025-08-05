import mongoose from 'mongoose';

//나중에 difficulty추가
const ArenaSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true   
    },
    host: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    instanceId: {
        type: String
    },
    publicIp: {
        type: String
    },
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        isReady: {
            type: Boolean,
            default: false
        },
        hasLeft: {
            type: Boolean,
            default: false
        }
    }],
    maxParticipants: {
        type: Number,
        default: 2,
        min: 2,
        max: 4
    },
    category: {
        type: String,
        enum: ['Web', 'Network', 'Database', 'Crypto', 'Cloud', 'AI', 'OS', 'Random'],
        required: true
    },
    machine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machine',
        required: true
    },
    duration: {
        type: Number,
        required: true,
        default: 30
    },
    startTime: {
        type: Date,
        required: null
    },
    endTime: {
        type: Date,
        required: null
    },
    status: {
        type: String,
        enum: ['waiting', 'started', 'ended'],
        default: 'waiting'
    },
    arenaExp: {
        type: Number,
        required: true,
        default: 50 
    },
    submissions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        submitttedAt: Date,
        flagCorrect: Boolean
    }],
    ranking: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        rank: Number
    }]
}, {
    timestamps: true  
});

const Arena = mongoose.model('Arena', ArenaSchema);

export default Arena;