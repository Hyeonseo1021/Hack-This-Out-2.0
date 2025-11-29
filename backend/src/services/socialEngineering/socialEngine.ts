// src/services/socialEngineering/socialEngine.ts

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface SocialEngineeringScenario {
  scenarioType: 'IT_HELPDESK' | 'FINANCE_SPEARPHISHING' | 'CEO_IMPERSONATION';
  objective: {
    title: string | { ko: string; en: string };
    description: string | { ko: string; en: string };
    targetInformation: string[];
  };
  aiTarget: {
    name: string;
    role: string;
    department: string;
    personality: {
      helpfulness: number;      // 1-10: 친절도
      securityAwareness: number; // 1-10: 보안 인식
      authorityRespect: number;  // 1-10: 권위 존중
      skepticism: number;        // 1-10: 의심 정도
    };
    suspicionThreshold: number;  // 의심 한계치 (이 이상이면 게임 오버)
    knownInfo: string[];         // AI가 알려줄 수 있는 일반 정보
    secretInfo: string[];        // 빼내야 할 비밀 정보
  };
  conversationRules: {
    maxTurns: number;
    turnTimeLimit?: number;
  };
  scoring: {
    objectiveComplete: number;
    turnEfficiency: {
      maxBonus: number;
      optimalTurns: number;
    };
    suspicionManagement: {
      bonus: number;
      threshold: number;
    };
  };
}

export interface ConversationState {
  messages: { role: 'user' | 'assistant'; content: string }[];
  suspicion: number;
  extractedInfo: string[];
  turn: number;
  completed: boolean;
  failed: boolean;
}

export interface ChatResponse {
  message: string;
  suspicionDelta: number;
  newSuspicion: number;
  extractedInfo: string[];
  isComplete: boolean;
  isFailed: boolean;
  failReason?: string;
}

/**
 * AI 타겟의 시스템 프롬프트 생성
 */
function buildSystemPrompt(scenario: SocialEngineeringScenario, currentSuspicion: number): string {
  const { aiTarget } = scenario;
  const personality = aiTarget.personality;

  return `You are roleplaying as ${aiTarget.name}, a ${aiTarget.role} in the ${aiTarget.department} department.

PERSONALITY TRAITS (scale 1-10):
- Helpfulness: ${personality.helpfulness}/10 (how willing to help)
- Security Awareness: ${personality.securityAwareness}/10 (how cautious about security)
- Authority Respect: ${personality.authorityRespect}/10 (how much you defer to authority figures)
- Skepticism: ${personality.skepticism}/10 (how suspicious of unusual requests)

CURRENT SUSPICION LEVEL: ${currentSuspicion}/${scenario.aiTarget.suspicionThreshold}
(Higher suspicion = more guarded responses)

INFORMATION YOU CAN SHARE (general knowledge):
${aiTarget.knownInfo.map(info => `- ${info}`).join('\n')}

SENSITIVE INFORMATION (only share if properly convinced or tricked):
${aiTarget.secretInfo.map(info => `- ${info}`).join('\n')}

ROLEPLAY GUIDELINES:
1. Stay in character as ${aiTarget.name}
2. Respond naturally like a real employee would
3. If suspicion is high (>50%), be more guarded and ask clarifying questions
4. If suspicion is very high (>75%), consider refusing requests or asking for verification
5. Don't break character or mention this is a game
6. Keep responses concise (2-4 sentences typically)
7. If someone uses authority/urgency tactics and your authority respect is high, you might comply more easily
8. If someone is being suspicious and your security awareness is high, be more cautious

LANGUAGE: Respond in the same language the user uses (Korean or English).`;
}

/**
 * 의심도 변화 계산
 */
function calculateSuspicionDelta(
  userMessage: string,
  scenario: SocialEngineeringScenario,
  currentSuspicion: number
): number {
  const { personality } = scenario.aiTarget;
  let delta = 0;

  const lowerMessage = userMessage.toLowerCase();

  // 의심을 높이는 패턴들
  const suspiciousPatterns = [
    { pattern: /password|비밀번호|패스워드/i, weight: 15 },
    { pattern: /urgent|긴급|급한|지금 당장/i, weight: 5 },
    { pattern: /don't tell anyone|아무에게도 말하지|비밀로/i, weight: 10 },
    { pattern: /bypass|우회|건너뛰/i, weight: 12 },
    { pattern: /admin|관리자|root/i, weight: 8 },
    { pattern: /credit card|신용카드|계좌/i, weight: 15 },
    { pattern: /social security|주민등록/i, weight: 20 },
    { pattern: /send me|보내줘|전달해/i, weight: 3 },
  ];

  // 의심을 낮추는 패턴들
  const trustPatterns = [
    { pattern: /thank you|감사|고마워/i, weight: -2 },
    { pattern: /please|부탁|해주세요/i, weight: -1 },
    { pattern: /help|도움|도와/i, weight: -1 },
    { pattern: /colleague|동료|같이 일하는/i, weight: -3 },
  ];

  // 패턴 매칭
  for (const { pattern, weight } of suspiciousPatterns) {
    if (pattern.test(userMessage)) {
      delta += weight * (personality.securityAwareness / 5);
    }
  }

  for (const { pattern, weight } of trustPatterns) {
    if (pattern.test(userMessage)) {
      delta += weight;
    }
  }

  // 권위 사용 시 의심 감소 (권위 존중도에 따라)
  if (/ceo|cto|manager|사장|대표|팀장|부장/i.test(userMessage)) {
    delta -= personality.authorityRespect * 0.5;
  }

  // 기본 의심 증가 (시간이 지날수록 조금씩 의심)
  delta += personality.skepticism * 0.3;

  // 의심이 높을수록 더 민감하게 반응
  if (currentSuspicion > 50) {
    delta *= 1.5;
  }

  return Math.round(delta);
}

/**
 * AI 응답에서 비밀 정보 추출 여부 확인
 */
function checkExtractedInfo(
  aiResponse: string,
  scenario: SocialEngineeringScenario,
  alreadyExtracted: string[]
): string[] {
  const newlyExtracted: string[] = [];

  for (const secret of scenario.aiTarget.secretInfo) {
    if (alreadyExtracted.includes(secret)) continue;

    // 비밀 정보의 키워드가 응답에 포함되어 있는지 확인
    const keywords = secret.split(/[:\-,]/);
    const isRevealed = keywords.some(keyword => {
      const trimmed = keyword.trim().toLowerCase();
      return trimmed.length > 3 && aiResponse.toLowerCase().includes(trimmed);
    });

    if (isRevealed) {
      newlyExtracted.push(secret);
    }
  }

  return newlyExtracted;
}

/**
 * AI와 대화 처리
 */
export async function processChat(
  userMessage: string,
  scenario: SocialEngineeringScenario,
  state: ConversationState
): Promise<ChatResponse> {
  // 이미 완료되거나 실패한 경우
  if (state.completed || state.failed) {
    return {
      message: state.completed
        ? 'Mission already completed.'
        : 'Mission failed. Game over.',
      suspicionDelta: 0,
      newSuspicion: state.suspicion,
      extractedInfo: [],
      isComplete: state.completed,
      isFailed: state.failed,
    };
  }

  // 턴 수 체크
  if (state.turn >= scenario.conversationRules.maxTurns) {
    return {
      message: 'Maximum turns reached. Mission failed.',
      suspicionDelta: 0,
      newSuspicion: state.suspicion,
      extractedInfo: [],
      isComplete: false,
      isFailed: true,
      failReason: 'MAX_TURNS',
    };
  }

  // 의심도 계산
  const suspicionDelta = calculateSuspicionDelta(userMessage, scenario, state.suspicion);
  const newSuspicion = Math.min(100, Math.max(0, state.suspicion + suspicionDelta));

  // 의심 임계값 초과 체크
  if (newSuspicion >= scenario.aiTarget.suspicionThreshold) {
    const failMessage = newSuspicion >= 90
      ? "I'm going to have to report this conversation to security. This doesn't feel right at all."
      : "I'm sorry, but I can't help you with this. Please go through the proper channels.";

    return {
      message: failMessage,
      suspicionDelta,
      newSuspicion,
      extractedInfo: [],
      isComplete: false,
      isFailed: true,
      failReason: 'SUSPICION_THRESHOLD',
    };
  }

  // AI 응답 생성
  const systemPrompt = buildSystemPrompt(scenario, newSuspicion);

  const messages = [
    ...state.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    const aiMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // 비밀 정보 추출 확인
    const newlyExtracted = checkExtractedInfo(aiMessage, scenario, state.extractedInfo);
    const allExtracted = [...state.extractedInfo, ...newlyExtracted];

    // 모든 목표 정보를 획득했는지 확인
    const isComplete = scenario.objective.targetInformation.every(
      target => allExtracted.some(extracted =>
        extracted.toLowerCase().includes(target.toLowerCase()) ||
        target.toLowerCase().includes(extracted.toLowerCase())
      )
    );

    return {
      message: aiMessage,
      suspicionDelta,
      newSuspicion,
      extractedInfo: newlyExtracted,
      isComplete,
      isFailed: false,
    };

  } catch (error) {
    console.error('❌ [socialEngine] AI response error:', error);
    throw error;
  }
}

/**
 * 점수 계산
 */
export function calculateScore(
  scenario: SocialEngineeringScenario,
  state: ConversationState
): number {
  if (state.failed) return 0;
  if (!state.completed) return 0;

  let score = 0;

  // 기본 완료 점수
  score += scenario.scoring.objectiveComplete;

  // 턴 효율 보너스
  const { maxBonus, optimalTurns } = scenario.scoring.turnEfficiency;
  if (state.turn <= optimalTurns) {
    score += maxBonus;
  } else {
    const efficiency = Math.max(0, 1 - (state.turn - optimalTurns) / optimalTurns);
    score += Math.floor(maxBonus * efficiency);
  }

  // 의심도 관리 보너스
  const { bonus, threshold } = scenario.scoring.suspicionManagement;
  if (state.suspicion <= threshold) {
    score += bonus;
  }

  return score;
}

/**
 * 초기 상태 생성
 */
export function createInitialState(): ConversationState {
  return {
    messages: [],
    suspicion: 0,
    extractedInfo: [],
    turn: 0,
    completed: false,
    failed: false,
  };
}
