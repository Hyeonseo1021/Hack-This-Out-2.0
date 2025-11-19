// services/forensicsRush/forensicsEngine.ts
import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import { ForensicsRushData } from '../../types/ArenaScenarioData';

/**
 * 답변 제출 결과 인터페이스
 */
export interface SubmitResult {
  success: boolean;
  message: string;
  correct: boolean;
  questionId: string;
  points: number;
  penalty: number;
  totalScore: number;
  attempts: number;
  questionsAnswered: number;
  questionsCorrect: number;
  perfectScore?: boolean;
  allCompleted?: boolean;
}

/**
 * Forensics Rush 모드의 답변 제출 처리
 * @param arenaId - 현재 아레나 ID
 * @param userId - 답변을 제출한 유저 ID
 * @param questionId - 질문 ID
 * @param userAnswer - 유저가 제출한 답변
 */
export const submitAnswer = async (
  arenaId: string,
  userId: string,
  questionId: string,
  userAnswer: string
): Promise<SubmitResult> => {
  
  console.log(`\n🔍 [forensicsEngine] Processing answer submission`);
  console.log(`   Arena: ${arenaId}, User: ${userId}`);
  console.log(`   Question: ${questionId}, Answer: "${userAnswer}"`);
  
  try {
    // 1. Arena에서 scenarioId 가져오기
    const arena = await Arena.findById(arenaId).populate('scenarioId');
    if (!arena || !arena.scenarioId) {
      return {
        success: false,
        message: 'Arena or scenario not found',
        correct: false,
        questionId,
        points: 0,
        penalty: 0,
        totalScore: 0,
        attempts: 0,
        questionsAnswered: 0,
        questionsCorrect: 0
      };
    }

    const scenario = arena.scenarioId as any;
    const scenarioData: ForensicsRushData = scenario.data;
    
    console.log(`   Loaded scenario: ${scenario.title}`);

    // 2. 질문 찾기
    const question = scenarioData.questions.find(q => q.id === questionId);
    if (!question) {
      return {
        success: false,
        message: 'Question not found',
        correct: false,
        questionId,
        points: 0,
        penalty: 0,
        totalScore: 0,
        attempts: 0,
        questionsAnswered: 0,
        questionsCorrect: 0
      };
    }

    console.log(`   Question: ${question.question}`);
    console.log(`   Expected answer(s):`, question.answer);

    // 3. 유저의 진행 상황 가져오기
    let progressDoc = await ArenaProgress.findOne({ 
      arena: arenaId, 
      user: userId 
    });

    if (!progressDoc) {
      // 진행 상황이 없으면 생성
      progressDoc = await ArenaProgress.create({
        arena: arenaId,
        user: userId,
        score: 0,
        stage: 0,
        forensicsRush: {
          questionsAnswered: 0,
          questionsCorrect: 0,
          totalAttempts: 0,
          penalties: 0,
          perfectScore: false,
          answers: []
        }
      });
    }

    // 4. 이미 정답을 맞춘 문제인지 확인
    const existingAnswer = progressDoc.forensicsRush?.answers?.find(
      a => a.questionId === questionId && a.correct === true
    );

    if (existingAnswer) {
      return {
        success: false,
        message: 'You have already answered this question correctly',
        correct: false,
        questionId,
        points: 0,
        penalty: 0,
        totalScore: progressDoc.score || 0,
        attempts: existingAnswer.attempts || 1,
        questionsAnswered: progressDoc.forensicsRush?.questionsAnswered || 0,
        questionsCorrect: progressDoc.forensicsRush?.questionsCorrect || 0
      };
    }

    // 5. 답변 검증 (대소문자 무시, 공백 제거)
    const normalizedUserAnswer = userAnswer.trim().toLowerCase();
    let isCorrect = false;

    if (Array.isArray(question.answer)) {
      // 배열인 경우 (multiple-choice)
      isCorrect = question.answer.some(ans => 
        ans.trim().toLowerCase() === normalizedUserAnswer
      );
    } else {
      // 단일 답변
      isCorrect = question.answer.trim().toLowerCase() === normalizedUserAnswer;
    }

    console.log(`   Normalized answer: "${normalizedUserAnswer}"`);
    console.log(`   Is correct: ${isCorrect}`);

    // 6. 시도 횟수 계산
    const previousAttempts = progressDoc.forensicsRush?.answers?.filter(
      a => a.questionId === questionId
    ).length || 0;
    const currentAttempt = previousAttempts + 1;

    // 7. 점수 및 페널티 계산
    let pointsGained = 0;
    let penalty = 0;

    if (isCorrect) {
      pointsGained = question.points || 10;
    } else {
      // 오답 페널티
      penalty = scenarioData.scoring.wrongAnswerPenalty || 5;
    }

    // 8. ArenaProgress 업데이트
    const updateData: any = {
      $inc: {
        'forensicsRush.totalAttempts': 1
      },
      $push: {
        'forensicsRush.answers': {
          questionId,
          answer: userAnswer,
          correct: isCorrect,
          attempts: currentAttempt,
          answeredAt: new Date(),
          points: isCorrect ? pointsGained : 0
        }
      }
    };

    if (isCorrect) {
      // 정답인 경우
      updateData.$inc.score = pointsGained;
      updateData.$inc['forensicsRush.questionsCorrect'] = 1;
      
      // 첫 정답인 경우에만 questionsAnswered 증가
      if (previousAttempts === 0) {
        updateData.$inc['forensicsRush.questionsAnswered'] = 1;
      }
    } else {
      // 오답인 경우
      updateData.$inc.score = -penalty;
      updateData.$inc['forensicsRush.penalties'] = penalty;
    }

    const updatedProgress = await ArenaProgress.findOneAndUpdate(
      { arena: arenaId, user: userId },
      updateData,
      { new: true, upsert: true }
    );

    console.log(`   Updated score: ${updatedProgress.score}`);
    console.log(`   Questions correct: ${updatedProgress.forensicsRush?.questionsCorrect || 0}`);

    // 9. 모든 문제를 풀었는지 확인
    const questionsCorrect = updatedProgress.forensicsRush?.questionsCorrect || 0;
    const totalQuestions = scenarioData.totalQuestions || scenarioData.questions.length;
    const allCompleted = questionsCorrect >= totalQuestions;

    // 10. Perfect Score 체크 (모든 문제를 첫 시도에 맞춤)
    let perfectScore = false;
    let finalScore = updatedProgress.score;
    
    if (allCompleted) {
      const allAnswers = updatedProgress.forensicsRush?.answers || [];
      const correctAnswers = allAnswers.filter(a => a.correct);
      
      // 모든 정답이 첫 시도였는지 확인
      perfectScore = correctAnswers.every(a => a.attempts === 1);
      
      if (perfectScore) {
        // ✅ Perfect Score 보너스 추가
        const bonus = scenarioData.scoring.perfectScoreBonus || 50;
        const bonusUpdate = await ArenaProgress.findOneAndUpdate(
          { arena: arenaId, user: userId },
          { 
            $inc: { score: bonus },
            $set: { 'forensicsRush.perfectScore': true }
          },
          { new: true }
        );
        
        finalScore = bonusUpdate?.score || (updatedProgress.score + bonus);
        console.log(`   🎉 Perfect Score! Bonus: +${bonus}, Final Score: ${finalScore}`);
      }
    }

    // ✅ 11. 결과 반환 (중복 보너스 제거)
    return {
      success: true,
      message: isCorrect 
        ? `Correct! +${pointsGained} points` 
        : `Incorrect. -${penalty} points`,
      correct: isCorrect,
      questionId,
      points: isCorrect ? pointsGained : 0,
      penalty: isCorrect ? 0 : penalty,
      totalScore: finalScore, // ✅ 이미 보너스가 포함된 최종 점수
      attempts: currentAttempt,
      questionsAnswered: updatedProgress.forensicsRush?.questionsAnswered || 0,
      questionsCorrect: updatedProgress.forensicsRush?.questionsCorrect || 0,
      perfectScore,
      allCompleted
    };

  } catch (error) {
    console.error(`   ❌ Error in submitAnswer:`, error);
    return {
      success: false,
      message: `Internal error: ${(error as Error).message}`,
      correct: false,
      questionId,
      points: 0,
      penalty: 0,
      totalScore: 0,
      attempts: 0,
      questionsAnswered: 0,
      questionsCorrect: 0
    };
  }
};

/**
 * 유저의 현재 진행 상황 조회
 */
export const getUserProgress = async (
  arenaId: string,
  userId: string
) => {
  try {
    const arena = await Arena.findById(arenaId).populate('scenarioId');
    if (!arena || !arena.scenarioId) {
      return null;
    }

    const scenario = arena.scenarioId as any;
    const scenarioData: ForensicsRushData = scenario.data;

    const progressDoc = await ArenaProgress.findOne({ 
      arena: arenaId, 
      user: userId 
    }).lean();

    if (!progressDoc) {
      return {
        score: 0,
        questionsAnswered: 0,
        questionsCorrect: 0,
        totalAttempts: 0,
        penalties: 0,
        answers: [],
        totalQuestions: scenarioData.totalQuestions || scenarioData.questions.length
      };
    }

    return {
      score: progressDoc.score || 0,
      questionsAnswered: progressDoc.forensicsRush?.questionsAnswered || 0,
      questionsCorrect: progressDoc.forensicsRush?.questionsCorrect || 0,
      totalAttempts: progressDoc.forensicsRush?.totalAttempts || 0,
      penalties: progressDoc.forensicsRush?.penalties || 0,
      answers: progressDoc.forensicsRush?.answers || [],
      perfectScore: progressDoc.forensicsRush?.perfectScore || false,
      totalQuestions: scenarioData.totalQuestions || scenarioData.questions.length
    };

  } catch (error) {
    console.error('[getUserProgress] error:', error);
    return null;
  }
};