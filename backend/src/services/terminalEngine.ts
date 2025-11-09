// src/services/terminalEngine.ts

import Arena from '../models/Arena'; // ‼️ (Arena는 이제 필요 없습니다, 지워도 됩니다)
import ArenaProgress from '../models/ArenaProgress'; // ‼️ ArenaProgress 모델 import
import { getChallengeForStage, TerminalResult } from './terminalChallenges';

/**
 * 'Terminal Race' 모드의 명령어 입력을 처리하는 메인 엔진
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
  
  // ----------------------------------------------------
  // ‼️ 1. (수정) ArenaProgress에서 유저의 현재 스테이지 가져오기 ‼️
  const progressDoc = await ArenaProgress.findOne({ arena: arenaId, user: userId });
  
  // ‼️ 유저의 현재 스테이지 (기본값: 0, 실제 게임은 stage 1부터 시작)
  // DB stage 0 = 게임 stage 1
  // DB stage 1 = 게임 stage 2
  const dbStage = progressDoc?.stage || 0;
  const currentStageNum = dbStage + 1; // 게임 스테이지는 1부터 시작
  console.log(`   DB Stage: ${dbStage}, Game Stage: ${currentStageNum}`);
  // ----------------------------------------------------

  // 2. 현재 스테이지에 맞는 "정답지" 불러오기
  const challenge = getChallengeForStage(currentStageNum);
  if (!challenge) {
    if (currentStageNum > 4) { // 4가 마지막 스테이지라고 가정
       return { message: 'You have already completed all stages!' };
    }
    return { message: `Error: No challenge found for stage ${currentStageNum}.` };
  }

  console.log(`   Challenge loaded for stage ${currentStageNum}`);

  // 3. 사용자 입력 파싱 (동일)
  const parts = userCommand.trim().split(' ');
  const command = parts[0]; // 예: "exploit"
  const args = parts.slice(1);

  console.log(`   Parsed - Command: "${command}", Args:`, args);

  // 4. "정답지"와 대조하여 응답 생성 (동일)
  let handler;
  if (challenge.commandHandlers.has(command)) {
    handler = challenge.commandHandlers.get(command)!;
    console.log(`   ✅ Handler found for command: ${command}`);
  } else {
    handler = challenge.defaultHandler;
    args.unshift(command);
    console.log(`   ⚠️ No handler found, using default handler`);
  }

  // 5. 핸들러 함수를 실행하여 결과 반환 (동일)
  try {
    const result = handler(args);
    console.log(`   Result:`, result);
    return result;
  } catch (e) {
    console.error(`   ❌ Error executing handler:`, e);
    return { message: `Command execution failed: ${(e as Error).message}` };
  }
};