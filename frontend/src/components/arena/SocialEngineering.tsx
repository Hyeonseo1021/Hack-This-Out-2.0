import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import '../../assets/scss/arena/SocialEngineering.scss';

type Participant = {
  user: { _id: string; username: string } | string;
  isReady: boolean;
  hasLeft?: boolean;
  progress?: any;
};

interface SocialEngineeringProps {
  arena: { _id: string; mode: string };
  socket: Socket;
  currentUserId: string | null;
  participants: Participant[];
  scenario?: {
    title: { ko: string; en: string } | string;
    description: { ko: string; en: string } | string;
    difficulty: string;
  } | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

interface ScenarioData {
  scenarioType: string;
  objective: {
    title: string | { ko: string; en: string };
    description: string | { ko: string; en: string };
    targetInformation: string[];
  };
  aiTarget: {
    name: string;
    role: string;
    department: string;
  };
  conversationRules: {
    maxTurns: number;
    turnTimeLimit?: number;
  };
}

interface GameState {
  suspicion: number;
  turn: number;
  maxTurns: number;
  extractedInfo: string[];
  completed: boolean;
  failed: boolean;
}

interface ResponseData {
  message: string;
  suspicionDelta: number;
  newSuspicion: number;
  extractedInfo: string[];
  turn: number;
  maxTurns: number;
  isComplete: boolean;
  isFailed: boolean;
  failReason?: string;
}

interface GameOverData {
  success: boolean;
  score: number;
  finalSuspicion: number;
  turnsUsed: number;
  extractedInfo: string[];
  failReason?: string;
}

const SocialEngineering: React.FC<SocialEngineeringProps> = ({
  arena,
  socket,
  currentUserId: _currentUserId,
  scenario: _propScenario
}) => {
  const { t, i18n } = useTranslation('arena');

  const getBilingualText = (text: string | { ko: string; en: string } | undefined): string => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    const lang = i18n.language as 'ko' | 'en';
    return text[lang] || text.ko || text.en;
  };

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    suspicion: 0,
    turn: 0,
    maxTurns: 10,
    extractedInfo: [],
    completed: false,
    failed: false,
  });
  const [suspicionDelta, setSuspicionDelta] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [showExtractedNotice, setShowExtractedNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitializedRef = useRef(false);
  const isCompletedRef = useRef(false); // ✅ 완료 여부 추적용 ref

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initGame = async () => {
      try {
        const waitForConnection = () => {
          return new Promise<void>((resolve) => {
            if (socket.connected) resolve();
            else socket.once('connect', () => resolve());
          });
        };

        await waitForConnection();
        socket.emit('social:init', { arenaId: arena._id });
      } catch (error) {
        console.error('Failed to initialize:', error);
        setIsLoading(false);
      }
    };

    initGame();
  }, [socket, arena._id]);

  // Socket event handlers
  useEffect(() => {
    const handleInitData = (data: {
      scenario: ScenarioData;
      state: GameState;
      messages: Message[];
    }) => {
      setScenario(data.scenario);
      setGameState(data.state);
      setMessages(data.messages.map(m => ({ ...m, timestamp: new Date() })));
      setIsLoading(false);
    };

    const handleResponse = (data: ResponseData) => {
      // Add AI message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      }]);

      // Update game state
      setGameState(prev => ({
        ...prev,
        suspicion: data.newSuspicion,
        turn: data.turn,
        extractedInfo: [...prev.extractedInfo, ...data.extractedInfo],
        completed: data.isComplete,
        failed: data.isFailed,
      }));

      // Show suspicion delta
      if (data.suspicionDelta !== 0) {
        setSuspicionDelta(data.suspicionDelta);
        setTimeout(() => setSuspicionDelta(null), 2000);
      }

      // Show extracted info notice
      if (data.extractedInfo.length > 0) {
        setShowExtractedNotice(data.extractedInfo[0]);
        setTimeout(() => setShowExtractedNotice(null), 3000);
      }

      setIsSending(false);
    };

    const handleGameOver = (data: GameOverData) => {
      setGameOver(data);
      if (data.success) {
        isCompletedRef.current = true; // ✅ 완료 시 ref 업데이트
      }
    };

    const handleError = (data: { msg: string }) => {
      console.error('Social Engineering error:', data.msg);
      setIsSending(false);
    };

    const handleProgressData = (data: any) => {
      if (data.initialized) {
        setGameState({
          suspicion: data.suspicion,
          turn: data.turn,
          maxTurns: data.maxTurns,
          extractedInfo: data.extractedInfo,
          completed: data.completed,
          failed: data.failed,
        });
        setMessages(data.messages?.map((m: Message) => ({ ...m, timestamp: new Date() })) || []);
      }
    };

    // ✅ 유예시간 시작 핸들러 (이미 완료한 사람은 제외)
    const handleGracePeriodStarted = (data: { graceSec: number; message: string }) => {
      // 이미 완료한 사용자는 경고 표시하지 않음
      if (isCompletedRef.current) return;

      const graceMin = Math.floor(data.graceSec / 60);
      const graceSec = data.graceSec % 60;
      const timeStr = graceMin > 0
        ? `${graceMin}:${String(graceSec).padStart(2, '0')}`
        : `${graceSec}s`;

      const graceMessage = i18n.language === 'ko'
        ? `⚠️ [SYSTEM] 유예 시간 시작: 다른 플레이어가 완료했습니다! 남은 시간: ${timeStr}`
        : `⚠️ [SYSTEM] GRACE PERIOD STARTED: Another player has completed the challenge! Time remaining: ${timeStr}`;

      // 시스템 메시지로 채팅창에 표시
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: graceMessage,
        timestamp: new Date(),
      }]);
    };

    socket.on('social:init-data', handleInitData);
    socket.on('social:response', handleResponse);
    socket.on('social:game-over', handleGameOver);
    socket.on('social:error', handleError);
    socket.on('social:progress-data', handleProgressData);
    socket.on('arena:grace-period-started', handleGracePeriodStarted);

    return () => {
      socket.off('social:init-data', handleInitData);
      socket.off('social:response', handleResponse);
      socket.off('social:game-over', handleGameOver);
      socket.off('social:error', handleError);
      socket.off('social:progress-data', handleProgressData);
      socket.off('arena:grace-period-started', handleGracePeriodStarted);
    };
  }, [socket]);

  // Send message
  const handleSendMessage = useCallback(() => {
    if (!message.trim() || isSending || gameState.completed || gameState.failed) return;

    const userMessage = message.trim();
    setMessage('');
    setIsSending(true);

    // Add user message immediately
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }]);

    // Send to server
    socket.emit('social:send-message', {
      arenaId: arena._id,
      message: userMessage,
    });
  }, [message, isSending, gameState.completed, gameState.failed, socket, arena._id]);

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get suspicion level class
  const getSuspicionClass = () => {
    if (gameState.suspicion < 25) return 'low';
    if (gameState.suspicion < 50) return 'medium';
    if (gameState.suspicion < 75) return 'high';
    return 'critical';
  };

  // Get suspicion color for value display
  const getSuspicionColor = () => {
    if (gameState.suspicion < 25) return '#22c55e';
    if (gameState.suspicion < 50) return '#fbbf24';
    if (gameState.suspicion < 75) return '#f97316';
    return '#ef4444';
  };

  if (isLoading) {
    return (
      <div className="social-engineering-container">
        <div className="social-loading-container">
          <div className="loading-spinner" />
          <p>{t('social.loading', '미션 브리핑 로딩 중...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="social-engineering-container">
      {/* Mission Briefing */}
      <div className="mission-briefing">
        <div className="mission-info">
          <span className="mission-type">
            {scenario?.scenarioType?.replace(/_/g, ' ') || 'SOCIAL ENGINEERING'}
          </span>
          <h2 className="mission-title">
            {getBilingualText(scenario?.objective?.title) || t('social.missionTitle', '정보 획득 미션')}
          </h2>
          <p className="mission-description">
            {getBilingualText(scenario?.objective?.description) || t('social.missionDesc', '대상으로부터 민감한 정보를 획득하세요.')}
          </p>

          <div className="target-info">
            <div className="target-avatar">
              {scenario?.aiTarget?.name?.charAt(0) || '?'}
            </div>
            <div className="target-details">
              <div className="target-name">{scenario?.aiTarget?.name || 'Unknown'}</div>
              <div className="target-role">
                {scenario?.aiTarget?.role} - {scenario?.aiTarget?.department}
              </div>
            </div>
          </div>
        </div>

        <div className="mission-stats">
          <div className="stat-box">
            <div className="stat-label">{t('social.turns', '턴')}</div>
            <div className="stat-value turns">
              {gameState.turn} / {gameState.maxTurns}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">{t('social.infoExtracted', '획득 정보')}</div>
            <div className="stat-value score">
              {gameState.extractedInfo.length} / {scenario?.objective?.targetInformation?.length || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Suspicion Meter */}
      <div className="suspicion-meter">
        <div className="suspicion-header">
          <span className="suspicion-label">
            <span className="warning-icon">⚠️</span>
            {t('social.suspicion', '의심도')}
          </span>
          <span className="suspicion-value" style={{ color: getSuspicionColor() }}>
            {gameState.suspicion}%
          </span>
        </div>
        <div className="suspicion-bar">
          <div
            className={`suspicion-fill ${getSuspicionClass()}`}
            style={{ width: `${gameState.suspicion}%` }}
          />
          <div
            className="threshold-marker"
            style={{ left: '80%' }}
          />
        </div>
        {suspicionDelta !== null && (
          <span className={`suspicion-delta ${suspicionDelta > 0 ? 'positive' : 'negative'}`}>
            {suspicionDelta > 0 ? '+' : ''}{suspicionDelta}%
          </span>
        )}
      </div>

      {/* Chat Window */}
      <div className="chat-window">
        <div className="chat-header">
          <div className="chat-contact">
            <div className="contact-avatar">
              {scenario?.aiTarget?.name?.charAt(0) || '?'}
            </div>
            <div className="contact-info">
              <div className="contact-name">{scenario?.aiTarget?.name || 'Unknown'}</div>
              <div className="contact-status">{t('social.online', '온라인')}</div>
            </div>
          </div>
        </div>

        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role === 'user' ? 'sent' : 'received'}`}>
              <div className={`message-avatar ${msg.role === 'user' ? 'user-avatar' : 'ai-avatar'}`}>
                {msg.role === 'user' ? '👤' : scenario?.aiTarget?.name?.charAt(0) || '?'}
              </div>
              <div className="message-content">
                <div className="message-bubble">
                  {msg.content}
                </div>
                <div className="message-time">
                  {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {isSending && (
            <div className="typing-indicator">
              <div className="typing-avatar">
                {scenario?.aiTarget?.name?.charAt(0) || '?'}
              </div>
              <div className="typing-bubble">
                <span /><span /><span />
              </div>
            </div>
          )}

          {showExtractedNotice && (
            <div className="extracted-info-notice">
              🎯 {t('social.infoExtractedNotice', '정보 획득!')}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder={
                gameState.completed
                  ? t('social.missionComplete', '미션 완료!')
                  : gameState.failed
                  ? t('social.missionFailed', '미션 실패')
                  : t('social.inputPlaceholder', '메시지를 입력하세요...')
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSending || gameState.completed || gameState.failed}
            />
            <button
              className="send-button"
              onClick={handleSendMessage}
              disabled={!message.trim() || isSending || gameState.completed || gameState.failed}
            >
              <span className="send-icon">➤</span>
            </button>
          </div>
        </div>
      </div>

      {/* Game Over Overlay */}
      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-content">
            <div className="game-over-icon">
              {gameOver.success ? '🏆' : '💀'}
            </div>
            <h2 className={`game-over-title ${gameOver.success ? 'success' : 'failed'}`}>
              {gameOver.success
                ? t('social.success', '미션 성공!')
                : t('social.failed', '미션 실패')}
            </h2>
            <p className="game-over-message">
              {gameOver.success
                ? t('social.successMessage', '목표 정보를 모두 획득했습니다!')
                : gameOver.failReason === 'SUSPICION_THRESHOLD'
                ? t('social.failSuspicion', '의심을 너무 많이 받았습니다.')
                : gameOver.failReason === 'MAX_TURNS'
                ? t('social.failTurns', '턴이 모두 소진되었습니다.')
                : t('social.failMessage', '미션에 실패했습니다.')}
            </p>
            <div className="game-over-stats">
              <div className="stat">
                <div className="stat-value">{gameOver.score}</div>
                <div className="stat-label">{t('social.score', '점수')}</div>
              </div>
              <div className="stat">
                <div className="stat-value">{gameOver.turnsUsed}</div>
                <div className="stat-label">{t('social.turnsUsed', '사용 턴')}</div>
              </div>
              <div className="stat">
                <div className="stat-value">{gameOver.finalSuspicion}%</div>
                <div className="stat-label">{t('social.finalSuspicion', '최종 의심도')}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialEngineering;
