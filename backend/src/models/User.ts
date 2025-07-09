import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required : true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    avatar: {
        type: String
    },
    exp: {
        type: Number,
        default: 0
    },
    level: {
        type: Number,
        default: 1
    },
    rating: {
        type: Number,
        default: 0
    },
    tier: {
        type: Number,
        default: 1
    },
    isAdmin: { // Add this field
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Method to update level based on EXP
UserSchema.methods.updateLevel = function() {
    const levels = [
        0, 100, 300, 600, 1000, 1500, 2100, 3000, 4000, 5000, 
        6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000
    ]; // Max level is 20
    let newLevel = 1;
    for (let i = 0; i < levels.length; i++) {
        if (this.exp >= levels[i]) {
            newLevel = i + 1;
        } else {
            break;
        }
    }
    if (newLevel !== this.level) {
        this.level = newLevel;
        return this.save();
    }
    return Promise.resolve(this);
};

// Method to update tier based on rating
UserSchema.methods.updateTier = function () {
    const r = this.rating;
    let tier = 1;

    if (r >= 1000 && r < 2000) tier = 2;
    else if (r >= 2000 && r < 3000) tier = 3;
    else if (r >= 3000 && r < 4000) tier = 4;
    else if (r >= 4000 && r < 5000) tier = 5;
    else if (r >= 5000) tier = 6;

    if (this.tier !== tier) {
        this.tier = tier;
        return this.save();
    }

    return Promise.resolve(this);
}
const User = mongoose.model('user', UserSchema);

export default User;
