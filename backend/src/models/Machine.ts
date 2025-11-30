import mongoose from 'mongoose';

// Hint Schema
const HintSchema = new mongoose.Schema({
    content: {
      type: String,
      required: true
    },
    cost: {
      type: Number,
      required: true,
      default: 1,
      max: 10
    }
  }, {
    timestamps: true
});

// Review Schema
const ReviewSchema = new mongoose.Schema({
    reviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reviewerName: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1.0,
        max: 5.0
    },
    difficulty: {
        type: String,
        required: true,
        enum: ['very_easy', 'easy', 'medium', 'hard', 'very_hard']
    }
}, {
    timestamps: true
});

// Machine Schema
const MachineSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    category: { 
        type: String, 
        required: true
    },
    description: {
        type: String
    },
    exp: {
        type: Number,
        required: true,
        default: 50
    },
    amiId: { 
        type: String,
        required: true,
    },
    flag: { 
        type: String,
        required: true
    },
    rating: {
        type: Number,
        default: 1.0
    },
    // 난이도 시스템
    difficulty: {
        creatorLevel: {
            type: String,
            required: true,
            enum: ['very_easy', 'easy', 'medium', 'hard', 'very_hard']
        },
        confirmedLevel: {
            type: String,
            enum: ['very_easy', 'easy', 'medium', 'hard', 'very_hard']
        },
        isConfirmed: {
            type: Boolean,
            default: false
        },
        reviewCount: {
            type: Number,
            default: 0
        }
    },
    // 제작자 설문
    creatorSurvey: {
        estimatedTime: {
            type: Number, // 분 단위
            required: true
        },
        requiredSkills: {
            type: [String],
            default: []
        },
        technicalComplexity: {
            type: Number,
            min: 1,
            max: 5,
            required: true
        }
    },
    playerCount: {
        type: Number,
        default: 0
    },
    reviews: {
        type: [ReviewSchema],
        default: []
    },
    hints: {
        type: [HintSchema],
        default: []
    },
    hintSettings: {
        requiresItem: {
            type: Boolean,
            default: false  // false: 무료 힌트, true: 힌트권 필요
        },
        description: {
            type: String,
            default: '힌트를 무료로 사용할 수 있습니다.'
        }
    },
    isActive: {
        type: Boolean,
        required: true,
        default: false
    },
    forArena: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Function to update average rating after adding/updating/deleting a review
MachineSchema.methods.updateRating = async function() {
    if (!this.reviews || this.reviews.length === 0) {
        this.rating = 1.0;
    } else {
        const totalRating = this.reviews.reduce((sum: number, review: any) => sum + review.rating, 0);
        this.rating = parseFloat((totalRating / this.reviews.length).toFixed(1));
    }
    return this.save();
};

// Function to update difficulty based on reviews
MachineSchema.methods.updateDifficulty = async function() {
    const MIN_REVIEWS_FOR_CONFIRMATION = 3; // 최소 리뷰 수
    
    if (!this.reviews || this.reviews.length === 0) {
        return this;
    }

    // 난이도별 가중치
    const difficultyWeights: { [key: string]: number } = {
        'very_easy': 1,
        'easy': 2,
        'medium': 3,
        'hard': 4,
        'very_hard': 5
    };

    // 역방향 매핑
    const weightToDifficulty: { [key: number]: string } = {
        1: 'very_easy',
        2: 'easy',
        3: 'medium',
        4: 'hard',
        5: 'very_hard'
    };

    // 난이도 평균 계산
    const totalWeight = this.reviews.reduce((sum: number, review: any) => {
        return sum + (difficultyWeights[review.difficulty] || 3);
    }, 0);
    
    const avgWeight = Math.round(totalWeight / this.reviews.length);
    const confirmedLevel = weightToDifficulty[avgWeight] || 'medium';

    // 난이도 업데이트
    this.difficulty.confirmedLevel = confirmedLevel;
    this.difficulty.reviewCount = this.reviews.length;
    
    // 리뷰가 충분하면 확정
    if (this.reviews.length >= MIN_REVIEWS_FOR_CONFIRMATION) {
        this.difficulty.isConfirmed = true;
    }

    return this.save();
};

const Machine = mongoose.model('Machine', MachineSchema);

export default Machine;