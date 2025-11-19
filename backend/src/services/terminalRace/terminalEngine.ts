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

    const challengeData = scenario.data;
    console.log(`   Loaded scenario: ${scenario.title}`);
    
    const availableStages = challengeData.stages.map((s: any) => s.stage);
    console.log(`   📋 Available stages in scenario:`, availableStages);

    // 3. 유저의 현재 스테이지 가져오기
    const progressDoc = await ArenaProgress.findOne({ arena: arenaId, user: userId });
    console.log(`   📊 ProgressDoc for user ${userId}:`, {
      stage: progressDoc?.stage,
      score: progressDoc?.score,
      completed: progressDoc?.completed
    });
    
    const completedStages = progressDoc?.stage || 0;
    const currentStageNum = completedStages + 1;
    
    console.log(`   Completed Stages: ${completedStages}, Playing Stage: ${currentStageNum}/${challengeData.totalStages}`);

    // 4. 현재 스테이지 데이터 찾기
    const stageData = challengeData.stages.find((s: any) => s.stage === currentStageNum);
    
    if (!stageData) {
      console.error(`   ❌ Stage ${currentStageNum} NOT FOUND in scenario!`);
      console.error(`   Available stages:`, availableStages);
      
      if (currentStageNum > challengeData.totalStages) {
        return { message: 'You have already completed all stages!' };
      }
      return { message: `Error: Stage ${currentStageNum} not found in scenario.` };
    }

    console.log(`   ✅ Stage ${currentStageNum} found`);
    console.log(`   Current prompt: ${stageData.prompt}`);
    console.log(`   Available commands:`, stageData.commands.map((c: any) => c.command));

    // 5. 명령어 파싱
    const parts = userCommand.trim().split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    console.log(`   Parsed - Command: "${command}", Args:`, args);

    // 6. 명령어 매칭
    const matchedCommand = stageData.commands.find((cmd: any) => {
      // 명령어가 일치하지 않으면 false
      if (cmd.command !== command) {
        return false;
      }

      // 인자가 필요한 경우
      if (cmd.args && cmd.args.length > 0) {
        const requiredArgs = cmd.args;
        
        // ✅ 모든 필수 인자가 포함되어야 함
        const hasAllArgs = requiredArgs.every((reqArg: string) =>
          args.some(userArg => userArg === reqArg)
        );

        if (!hasAllArgs) {
          console.log(`   ⚠️ Missing required args. Required: ${requiredArgs}, Got: ${args}`);
          return false;
        }

        // ✅ 인자 개수도 일치해야 함
        if (args.length !== requiredArgs.length) {
          console.log(`   ⚠️ Arg count mismatch. Required: ${requiredArgs.length}, Got: ${args.length}`);
          return false;
        }

        return true;
      }
      
      // 인자가 필요 없는 명령어인데 인자가 주어진 경우
      if (args.length > 0) {
        console.log(`   ⚠️ Command "${command}" doesn't take arguments, but got: ${args}`);
        return false;
      }
      
      return true;
    });

    // 7. 결과 반환
    if (matchedCommand) {
      console.log(`   ✅ Command matched successfully!`);
      
      const result: TerminalResult = {
        message: matchedCommand.message || matchedCommand.response,
        progressDelta: matchedCommand.scoreGain || matchedCommand.progressDelta || 0,
        advanceStage: matchedCommand.advanceStage !== false,
        flagFound: matchedCommand.flagFound || false
      };
      
      console.log(`   📤 Returning result:`, result);
      return result;
      
    } else {
      console.log(`   ⚠️ Command not recognized - using default response`);
      
      const defaultMsg = stageData.defaultResponse
        ?.replace('{command}', command) 
        || `Command '${command}' not recognized.`;
      
      console.log(`   Default response: "${defaultMsg}"`);
      
      // ✅ 기본 응답은 점수나 진행 없음
      return {
        message: defaultMsg,
        progressDelta: 0,
        advanceStage: false,
        flagFound: false
      };
    }

  } catch (error) {
    console.error(`   ❌ Error in terminalProcessCommand:`, error);
    return { 
      message: `Internal error processing command: ${(error as Error).message}`,
      progressDelta: 0,
      advanceStage: false,
      flagFound: false
    };
  }
};