import mongoose from 'mongoose';

const LessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced'],
  },
  description: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  order: {
    type: Number,
    required: true,
  },
  estimatedTime: {
    type: Number, // 예상 소요 시간 (분)
    default: 30,
  },
  tags: [{
    type: String,
  }],
  practiceCode: {
    type: String, // 실습 예제 코드
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

export default mongoose.model('Lesson', LessonSchema);