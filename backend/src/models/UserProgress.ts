import mongoose from 'mongoose';

const UserProgressSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    machine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machine',
    },
    // ===== 여기부터 새로 추가 =====
    lesson: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
    },
    // ===== 여기까지 새로 추가 =====
    completed: {
        type: Boolean,
        default: false
    },
    completedAt: {
        type: Date
    },
    usedHints: {
        type: [String],
        default: []
    },
    remainingHints: {
        type: Number,
        default: 0
    },
    hintsUsed: {
        type: Number,
        default: 0
    },
    expEarned: {
        type: Number,
        default: 0
    },
    timeSpent: {
        type: Date,
        default: () => new Date(0)
    }
}, {
    timestamps: true
});

UserProgressSchema.methods.updateTimeSpent = function() {
    if (this.createdAt && this.updatedAt) {
        this.timeSpent = this.updatedAt.getTime() - this.createdAt.getTime();
    } else {
        this.timeSpent = 0;
    }
    return this.save();
};

const UserProgress = mongoose.model('UserProgress', UserProgressSchema);

export default UserProgress;