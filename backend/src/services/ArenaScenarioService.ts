// services/ArenaScenarioService.ts
import ArenaScenario from '../models/ArenaScenario';
import { ArenaMode, Difficulty } from '../models/ArenaScenario';

export class ArenaScenarioService {
  /**
   * 난이도별 랜덤 시나리오 가져오기
   */
  static async getRandomScenario(mode: ArenaMode, difficulty: Difficulty) {
    const scenarios = await ArenaScenario.aggregate([
      { 
        $match: { 
          mode, 
          difficulty, 
          isActive: true 
        } 
      },
      { $sample: { size: 1 } }
    ]);
    
    if (scenarios.length === 0) {
      throw new Error(`No scenarios found for ${mode} - ${difficulty}`);
    }
    
    const selected = scenarios[0];
    
    await ArenaScenario.updateOne(
      { _id: selected._id },
      { $inc: { usageCount: 1 } }
    );
    
    return selected;
  }

  /**
   * ID로 시나리오 가져오기
   */
  static async getScenarioById(scenarioId: string) {
    return await ArenaScenario.findById(scenarioId);
  }

  /**
   * 난이도별 시나리오 목록
   */
  static async getScenariosByDifficulty(mode: ArenaMode, difficulty: Difficulty) {
    return await ArenaScenario.find({
      mode,
      difficulty,
      isActive: true
    }).select('title description timeLimit usageCount');
  }

  /**
   * 시나리오 통계
   */
  static async getScenarioStats(mode: ArenaMode) {
    return await ArenaScenario.aggregate([
      { $match: { mode, isActive: true } },
      { 
        $group: {
          _id: '$difficulty',
          count: { $sum: 1 }
        }
      }
    ]);
  }
}