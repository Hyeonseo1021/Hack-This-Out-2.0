/**
 * terminalProcessCommand가 반환할 결과 객체 타입
 */
export interface TerminalResult {
  message: string;       // 터미널에 표시될 응답 메시지
  progressDelta?: number;  // 추가될 점수
  advanceStage?: boolean;  // 다음 스테이지로 이동 여부
  flagFound?: boolean;     // 최종 플래그 발견 여부
}

// '명령어'에 대한 '응답 함수' 타입
type CommandHandler = (args: string[]) => TerminalResult;

/**
 * 각 스테이지별 챌린지 정의
 * [cite_start](문서 3페이지의 명령어 예시 [cite: 41]를 기반으로 구성)
 */
interface ChallengeStage {
  stage: number;
  prompt: string; // (선택) 스테이지 진입 시 보여줄 메시지
  // '명령어'를 key로, '실행할 함수'를 value로 갖는 맵
  commandHandlers: Map<string, CommandHandler>;
  // 정의되지 않은 명령어가 들어왔을 때
  defaultHandler: CommandHandler;
}

// --- 챌린지 1: 정찰 (Reconnaissance) ---
const stage1Handlers = new Map<string, CommandHandler>([
  ['nmap', (args) => {
    // args[0]가 '-sV'일 경우
    return { 
      message: 'Scanning... [cite: 18][cite_start]\nOpen: 22 (SSH 7.4), 80 (Apache 2.4.18) [cite: 20]',
      progressDelta: 10,
      advanceStage: true // 2단계로 이동
    };
  }],
  ['scan', (args) => {
    return { 
      message: 'Quick scan complete. Found ports: 22, 80.',
      progressDelta: 5,
    };
  }]
]);

// --- 챌린지 2: 공격 (Attack) ---
const stage2Handlers = new Map<string, CommandHandler>([
  ['exploit', (args) => {
    if (args[0] === 'web' || args[0] === 'apache') {
      return {
        message: 'Exploiting... Shell obtained! [cite: 25, 28]',
        progressDelta: 30,
        advanceStage: true // 3단계로 이동
      };
    }
    return { message: 'Usage: exploit <target_service>' };
  }],
  ['sql', (args) => {
    // 예: sql injection
    return { message: 'SQL injection failed. Target is not vulnerable.' };
  }]
]);

// --- 챌린지 3: 권한 상승 (Privilege Escalation) ---
const stage3Handlers = new Map<string, CommandHandler>([
  ['find', (args) => {
    // 예: find / -perm-4000 [cite: 30]
    return { 
      message: 'Searching SUID... [cite: 31]\nFound: /usr/bin/some_binary',
      progressDelta: 10,
      advanceStage: true // 4단계로 이동
    };
  }],
  ['priv', (args) => {
    // 예: priv esc
    return { message: 'Privilege escalation failed. Binary not vulnerable.' };
  }]
]);

// --- 챌린지 4: 플래그 획득 (Flag) ---
const stage4Handlers = new Map<string, CommandHandler>([
  ['cat', (args) => {
    if (args.includes('flag.txt')) {
      return {
        message: 'FLAG{CONGRATS_YOU_ARE_THE_WINNER}',
        progressDelta: 50,
        flagFound: true // ‼️ 게임 종료 플래그 ‼️
      };
    }
    return { message: `cat: ${args[0] || ''}: No such file or directory` };
  }]
]);


/**
 * 모든 챌린지 스테이지 목록
 */
const stages: ChallengeStage[] = [
  {
    stage: 1,
    prompt: "Welcome. Start by scanning the target.",
    commandHandlers: stage1Handlers,
    defaultHandler: (args) => ({ message: `${args[0]}: command not found. Try 'nmap' or 'scan'.` })
  },
  {
    stage: 2,
    prompt: "Services found. Try to gain initial access. [cite: 286]",
    commandHandlers: stage2Handlers,
    defaultHandler: (args) => ({ message: `${args[0]}: command not found. Try 'exploit' or 'sql'.` })
  },
  {
    stage: 3,
    prompt: "Shell obtained! [cite_start]Now find a way to escalate privileges. [cite: 289]",
    commandHandlers: stage3Handlers,
    defaultHandler: (args) => ({ message: `${args[0]}: command not found. Try 'find' or 'priv'.` })
  },
  {
    stage: 4,
    prompt: "SUID binary found! [cite_start]Get the final flag. [cite: 290]",
    commandHandlers: stage4Handlers,
    defaultHandler: (args) => ({ message: `${args[0]}: command not found. Try 'cat'.` })
  }
];

/**
 * 현재 스테이지 번호에 맞는 챌린지 객체를 반환합니다.
 */
export const getChallengeForStage = (stageNum: number): ChallengeStage | undefined => {
  return stages.find(s => s.stage === stageNum);
};