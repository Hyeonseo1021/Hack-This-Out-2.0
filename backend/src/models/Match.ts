import mongoose, { Schema } from 'mongoose';

const MatchSchema = new mongoose.Schema({
    userA: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userB: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true  
    },
    machine: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machine',
        required: true
    }],
    status: {
        type: String,
        enum: ['waiting', 'ready', 'playing', 'finished', 'canceled'],
        default: 'waiting'
    },
    duration: {
        type: Number,
        default: 10
    },
    startedAt: {
        type: Date,
        default: null
    },
    endedAt: {
        type: Date,
        default: null
    },
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    submissions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        submittedAt: Date,
        correct: Boolean
    }],
    ratingChange: {
        userA: Number,
        userB: Number   
    }
}, { 
    timestamps: true
});

const Match = mongoose.model('Match', MatchSchema);
export default Match;