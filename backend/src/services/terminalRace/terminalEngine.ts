// src/services/terminalRace/terminalEngine.ts

import Arena from '../../models/Arena';
import ArenaProgress from '../../models/ArenaProgress';
import ArenaScenario from '../../models/ArenaScenario';

export interface TerminalResult {
  message: string;
  progressDelta?: number;
  advanceStage?: boolean;
  flagFound?: boolean;
}

/**
 * Terminal Hacking Race 모드의 명령어 입력을 처리하는 메인 엔진
 * @param arenaId - 현재 아레나 ID
 * @param userId - 명령어를 입력한 유저 ID
 * @param userCommand - 유저가 입력한 명령어 (예: "nmap -sV")
 */
export const terminalProcessCommand = async (
  arenaId: string,
  userId: string,
  userCommand: string
): Promise<TerminalResult> => {
  
  console.log(`\n🔧 [terminalEngine] Processing command for user ${userId}`);
  console.log(`   Command: "${userCommand}"`);
  
  try {
    // 1. Arena에서 scenarioId 가져오기
    const arena = await Arena.findById(arenaId).select('scenarioId');
    if (!arena || !arena.scenarioId) {
      return { message: 'Error: Arena or scenario not found.' };
    }

    // 2. DB에서 시나리오 데이터 로드
    const scenario = await ArenaScenario.findById(arena.scenarioId);
    if (!scenario) {
      return { message: 'Error: Scenario data not found.' };
    }

    const challengeData = scenario.data; // TerminalHackingRaceData 타입
    console.log(`   Loaded scenario: ${scenario.title}`);

    // 3. 유저의 현재 스테이지 가져오기
    const progressDoc = await ArenaProgress.findOne({ arena: arenaId, user: userId });
    const dbStage = progressDoc?.stage || 0;
    const currentStageNum = dbStage + 1; // 게임 스테이지는 1부터 시작
    
    console.log(`   DB Stage: ${dbStage}, Game Stage: ${currentStageNum}/${challengeData.totalStages}`);

    // 4. 현재 스테이지 데이터 찾기
    const stageData = challengeData.stages.find((s: any) => s.stage === currentStageNum);
    if (!stageData) {
      if (currentStageNum > challengeData.totalStages) {
        return { message: 'You have already completed all stages!' };
      }
      return { message: `Error: Stage ${currentStageNum} not found.` };
    }

    console.log(`   Current prompt: ${stageData.prompt}`);

    // 5. 명령어 파싱
    const parts = userCommand.trim().split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    console.log(`   Parsed - Command: "${command}", Args:`, args);

    // 6. 명령어 매칭
    const matchedCommand = stageData.commands.find((cmd: any) => {
      if (cmd.command !== command) return false;
      
      // args가 정의되어 있으면 정확히 일치하는지 확인
      if (cmd.args && cmd.args.length > 0) {
        // 모든 args가 일치해야 함
        return cmd.args.every((arg: string, idx: number) => args[idx] === arg);
      }
      return true; // args가 없으면 command만 일치하면 OK
    });

    // 7. 결과 반환
    if (matchedCommand) {
      console.log(`   ✅ Command matched!`);
      return {
        message: matchedCommand.response,
        progressDelta: matchedCommand.progressDelta,
        advanceStage: matchedCommand.advanceStage,
        flagFound: matchedCommand.flagFound
      };
    } else {
      console.log(`   ⚠️ Using default response`);
      return {
        message: stageData.defaultResponse.replace('{command}', command)
      };
    }

  } catch (error) {
    console.error(`   ❌ Error in terminalProcessCommand:`, error);
    return { 
      message: `Internal error processing command: ${(error as Error).message}` 
    };
  }
};