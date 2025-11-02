import express from 'express';
import { 
  getAllLessons, 
  getLessonDetail, 
  completeLesson,
  getUserProgress,
  askAI,
  createLesson,
  updateLesson,
  deleteLesson
} from '../controllers/LearningController';
import { verifyToken } from '../middlewares/Token';
import { verifyAdmin } from '../middlewares/Admin.js';
const LearningRoutes = express.Router();

// 공개 라우트
LearningRoutes.get('/lessons', getAllLessons);
LearningRoutes.get('/lessons/:id', getLessonDetail);

// 인증 필요 라우트
LearningRoutes.post('/lessons/:id/complete', verifyToken, completeLesson);
LearningRoutes.get('/progress', verifyToken, getUserProgress);
LearningRoutes.post('/ai/ask', verifyToken, askAI);

// 관리자 전용 (Admin 미들웨어 추가 필요)
LearningRoutes.post('/lessons', verifyToken, verifyAdmin, createLesson);
LearningRoutes.put('/lessons/:id', verifyToken, verifyAdmin, updateLesson);
LearningRoutes.delete('/lessons/:id', verifyToken, verifyAdmin, deleteLesson);

export default LearningRoutes;