import { Request, Response } from 'express';
import Lesson from '../models/Lesson';
import UserProgress from '../models/UserProgress'; // 기존 모델 사용
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// GET all lessons
export const getAllLessons = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    
    const filter: any = { isPublished: true };
    if (category) filter.category = category;
    
    const lessons = await Lesson.find(filter).sort({ order: 1 });
    
    // 유저의 진도 정보 함께 가져오기
    if (res.locals.jwtData) {
      const userId = res.locals.jwtData.id;
      const progresses = await UserProgress.find({ user: userId, lesson: { $exists: true } });
      
      const lessonsWithProgress = lessons.map(lesson => ({
        ...lesson.toObject(),
        completed: progresses.some(p => 
          p.lesson && p.lesson.toString() === lesson._id.toString() && p.completed
        ),
      }));
      
      res.status(200).json({ message: "OK", lessons: lessonsWithProgress });
      return;
    }
    
    res.status(200).json({ message: "OK", lessons: lessons });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "ERROR", cause: error.message });
  }
};

// GET lesson detail
export const getLessonDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const lesson = await Lesson.findById(id);
    
    if (!lesson) {
      res.status(404).json({ message: "ERROR", cause: "레슨을 찾을 수 없습니다." });
      return;
    }
    
    // 마지막 접근 시간 업데이트
    if (res.locals.jwtData) {
      const userId = res.locals.jwtData.id;
      await UserProgress.findOneAndUpdate(
        { user: userId, lesson: id },
        { updatedAt: new Date() },
        { upsert: true }
      );
    }
    
    res.status(200).json({ message: "OK", lesson: lesson });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "ERROR", cause: error.message });
  }
};

// POST complete lesson (User Only)
export const completeLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = res.locals.jwtData.id;
    
    const progress = await UserProgress.findOneAndUpdate(
      { user: userId, lesson: id },
      { 
        completed: true,
        completedAt: new Date(),
      },
      { upsert: true, new: true }
    );
    
    res.status(200).json({ message: "OK", progress: progress });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "ERROR", cause: error.message });
  }
};

// GET user progress
export const getUserProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData.id;
    const progresses = await UserProgress.find({ 
      user: userId, 
      lesson: { $exists: true } 
    }).populate('lesson');
    
    res.status(200).json({ message: "OK", progresses: progresses });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "ERROR", cause: error.message });
  }
};

// POST ask AI (User Only)
export const askAI = async (req: Request, res: Response): Promise<void> => {
  try {
    const { question, lessonId } = req.body;
    
    if (!question) {
      res.status(400).json({ message: "ERROR", cause: "질문을 입력해주세요." });
      return;
    }
    
    // 레슨 컨텍스트 가져오기
    let lessonContext = '';
    if (lessonId) {
      const lesson = await Lesson.findById(lessonId);
      if (lesson) {
        lessonContext = `현재 학습 중인 레슨: ${lesson.title}\n레슨 내용: ${lesson.description}\n\n`;
      }
    }
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `당신은 화이트햇 해킹과 보안을 가르치는 친절한 교육 어시스턴트입니다. 
초보자도 이해하기 쉽게 설명하며, 실습 예제를 포함합니다. 
항상 윤리적 해킹과 합법적인 학습을 강조합니다.
${lessonContext}`,
      messages: [
        { role: 'user', content: question }
      ],
    });
    
    const answer = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '답변을 생성할 수 없습니다.';
    
    res.status(200).json({ message: "OK", answer: answer });
    
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "ERROR", cause: error.message });
  }
};

// POST create lesson (Admin Only)
export const createLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const lesson = new Lesson(req.body);
    await lesson.save();
    res.status(201).json({ message: "OK", lesson: lesson });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "ERROR", cause: error.message });
  }
};

// PUT update lesson (Admin Only)
export const updateLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const lesson = await Lesson.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!lesson) {
      res.status(404).json({ message: "ERROR", cause: "레슨을 찾을 수 없습니다." });
      return;
    }
    
    res.status(200).json({ message: "OK", lesson: lesson });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "ERROR", cause: error.message });
  }
};

// DELETE lesson (Admin Only)
export const deleteLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const lesson = await Lesson.findByIdAndDelete(id);
    
    if (!lesson) {
      res.status(404).json({ message: "ERROR", cause: "레슨을 찾을 수 없습니다." });
      return;
    }
    
    res.status(200).json({ message: "OK", lesson: lesson });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "ERROR", cause: error.message });
  }
};