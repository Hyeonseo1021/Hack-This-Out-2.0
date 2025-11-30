import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createArena } from '../../api/axiosArena';
import '../../assets/scss/arena/AddArenaForm.scss';

const AddArenaForm: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('arena');
  const [formData, setFormData] = useState({
    name: '',
    mode: '',
    difficulty: '',
    maxParticipants: 2,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const modes = [
    { id: 'TERMINAL_HACKING_RACE', title: t('modes.TERMINAL_HACKING_RACE.title'), players: t('modes.TERMINAL_HACKING_RACE.players') },
    { id: 'VULNERABILITY_SCANNER_RACE', title: t('modes.VULNERABILITY_SCANNER_RACE.title'), players: t('modes.VULNERABILITY_SCANNER_RACE.players') },
    { id: 'FORENSICS_RUSH', title: t('modes.FORENSICS_RUSH.title'), players: t('modes.FORENSICS_RUSH.players') },
    { id: 'SOCIAL_ENGINEERING', title: t('modes.SOCIAL_ENGINEERING.title'), players: t('modes.SOCIAL_ENGINEERING.players'), disabled: true },
  ];

  const difficulties = [
    { id: 'EASY', title: t('difficulties.EASY') },
    { id: 'MEDIUM', title: t('difficulties.MEDIUM') },
    { id: 'HARD', title: t('difficulties.HARD') },
    { id: 'EXPERT', title: t('difficulties.EXPERT') },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
  };

  const handleModeSelect = (mode: string) => {
    setFormData(prev => ({ ...prev, mode }));
    if (mode === 'VULNERABILITY_SCANNER_RACE') {
      setFormData(prev => ({ ...prev, maxParticipants: 2 }));
    } else if (mode === 'SOCIAL_ENGINEERING') {
      setFormData(prev => ({ ...prev, maxParticipants: Math.min(prev.maxParticipants, 4) }));
    }
  };

  const handleDifficultySelect = (difficulty: string) => {
    setFormData(prev => ({ ...prev, difficulty }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.mode || !formData.difficulty) {
      setError(t('errors.allFieldsRequired'));
      return;
    }

    try {
      setLoading(true);
      const res = await createArena(formData);
      navigate(`/arena/${res.arena._id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('errors.failedToCreate');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getMaxParticipantsLimit = () => {
    if (formData.mode === 'VULNERABILITY_SCANNER_RACE') return { min: 2, max: 2 };
    if (formData.mode === 'SOCIAL_ENGINEERING') return { min: 1, max: 4 };
    return { min: 2, max: 8 };
  };

  const participantsLimit = getMaxParticipantsLimit();
  const selectedMode = modes.find(m => m.id === formData.mode);

  // 진행 상태 계산
  const getStepStatus = (step: number) => {
    if (step === 1) return formData.mode ? 'done' : 'active';
    if (step === 2) return formData.mode && formData.difficulty ? 'done' : formData.mode ? 'active' : '';
    if (step === 3) return formData.mode && formData.difficulty && formData.name ? 'done' : (formData.mode && formData.difficulty) ? 'active' : '';
    return '';
  };

  // 난이도 클래스 헬퍼
  const getDifficultyClass = () => {
    if (!formData.difficulty) return 'easy';
    return formData.difficulty.toLowerCase();
  };

  // 미리보기 렌더링
  const renderPreview = () => {
    if (!formData.mode) {
      return (
        <div className="preview-placeholder">
          <div className="placeholder-icon">▸</div>
          <p className="placeholder-text">
            게임 모드를 선택하면<br />
            미리보기가 표시됩니다
          </p>
        </div>
      );
    }

    if (formData.mode === 'TERMINAL_HACKING_RACE') {
      return (
        <div className="preview-terminal-race">
          {/* 게임 흐름 가이드 */}
          <div className="game-flow-guide">
            <div className="flow-title">게임 진행 흐름</div>
            <div className="flow-steps">
              <div className="flow-step completed">
                <span className="step-num">1</span>
                <span className="step-text">시나리오 확인</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step active">
                <span className="step-num">2</span>
                <span className="step-text">명령어 입력</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step">
                <span className="step-num">3</span>
                <span className="step-text">플래그 발견</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step">
                <span className="step-num">4</span>
                <span className="step-text">제출 완료</span>
              </div>
            </div>
          </div>

          {/* 시나리오 정보 바 - 실제 컴포넌트와 동일 */}
          <div className="scenario-info-bar">
            <div className="scenario-main">
              <div className="scenario-details">
                <h3 className="scenario-title">Mission: System Infiltration</h3>
                <p className="scenario-description">숨겨진 파일에서 플래그를 찾아 제출하세요</p>
              </div>
            </div>
            <div className="scenario-meta">
              <span className={`difficulty-badge difficulty-${getDifficultyClass()}`}>
                {formData.difficulty || 'EASY'}
              </span>
            </div>
          </div>

          {/* 터미널 윈도우 */}
          <div className="terminal-window">
            <div className="terminal-title-bar">
              <div className="terminal-controls">
                <span className="control-btn close"></span>
                <span className="control-btn minimize"></span>
                <span className="control-btn maximize"></span>
              </div>
              <span className="terminal-title-text">root@hackthisout:~</span>
              <div className="terminal-stats">
                <span className="stat-item">⏱ 05:00</span>
                <span className="stat-item">★ 0</span>
              </div>
            </div>
            <div className="terminal-output">
              <div className="terminal-line system">[SYSTEM] Terminal Race initialized</div>
              <div className="terminal-line prompt">숨겨진 파일을 찾아 플래그를 제출하세요.</div>
              <div className="terminal-line"><span className="command-text">ls -la</span></div>
              <div className="terminal-line output">-rw-r--r--  1 root root  220 .secret</div>
              <div className="terminal-line"><span className="command-text">cat .secret</span></div>
              <div className="terminal-line success">✓ Flag found! +100 PTS</div>
              {/* 인라인 힌트 */}
              <div className="inline-hint">
                <span className="hint-icon">💡</span>
                <span className="hint-text">리눅스 명령어를 입력하세요 (예: ls, cat, cd, grep)</span>
              </div>
            </div>
            <div className="terminal-input-area">
              <div className="input-wrapper">
                <span className="terminal-prompt">
                  <span className="prompt-user">user</span>
                  <span className="prompt-separator">@</span>
                  <span className="prompt-host">hackthisout</span>
                  <span className="prompt-path">:~$</span>
                </span>
                <input className="terminal-input" type="text" placeholder="Enter command..." readOnly />
              </div>
              <button className="terminal-submit-btn">EXECUTE</button>
            </div>
          </div>
        </div>
      );
    }

    if (formData.mode === 'VULNERABILITY_SCANNER_RACE') {
      return (
        <div className="preview-scanner-race">
          {/* 게임 흐름 가이드 */}
          <div className="game-flow-guide">
            <div className="flow-title">게임 진행 흐름</div>
            <div className="flow-steps">
              <div className="flow-step completed">
                <span className="step-num">1</span>
                <span className="step-text">타겟 분석</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step active">
                <span className="step-num">2</span>
                <span className="step-text">취약점 발견</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step">
                <span className="step-num">3</span>
                <span className="step-text">PoC 작성</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step">
                <span className="step-num">4</span>
                <span className="step-text">제출</span>
              </div>
            </div>
          </div>

          {/* 헤더 - 실제 컴포넌트와 동일 */}
          <div className="scanner-header">
            <div className="header-info">
              <h2 className="mode-title">Vulnerability Scanner</h2>
              <p className="target-name">Target: vulnerable-app.hackthisout.io</p>
            </div>
            <div className="header-stats">
              <div className="stat-box">
                <span className="stat-label">TIME</span>
                <span className="stat-value">10:00</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">SCORE</span>
                <span className="stat-value">0</span>
              </div>
              <div className="stat-box rank">
                <span className="stat-label">RANK</span>
                <span className="stat-value">#1</span>
              </div>
            </div>
          </div>

          {/* 메인 영역 */}
          <div className="scanner-main">
            {/* 타겟 컨테이너 */}
            <div className="target-container">
              <div className="target-header">
                <div className="header-title">
                  <span className="icon">🎯</span>
                  <h3>TARGET APPLICATION</h3>
                  <span className="vulns-remaining">0/4 Found</span>
                </div>
              </div>
              <div className="target-iframe">
                <div className="mock-webapp">
                  <div className="webapp-nav">vulnerable-app.hackthisout.io</div>
                  <div className="webapp-content">
                    <h4>Login Portal</h4>
                    <input className="mock-input" placeholder="Username" readOnly />
                    <input className="mock-input" placeholder="Password" type="password" readOnly />
                    <button className="mock-btn">Sign In</button>
                    {/* 인라인 힌트 */}
                    <div className="inline-hint">
                      <span className="hint-icon">💡</span>
                      <span className="hint-text">웹 애플리케이션의 취약점을 찾아 PoC 코드를 제출하세요</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 취약점 & 제출 섹션 */}
            <div className="info-panel">
              <div className="vulnerabilities-section">
                <div className="section-header">
                  <span className="icon">⚠️</span>
                  <h3>VULNERABILITIES</h3>
                  <span className="count">0/4</span>
                </div>
                <div className="vuln-list">
                  <div className="vuln-item">
                    <div className="vuln-status"><span className="status-indicator">○</span></div>
                    <div className="vuln-info">
                      <div className="vuln-name">SQL Injection</div>
                      <div className="vuln-meta">
                        <span className="severity severity-critical">CRITICAL</span>
                        <span className="points">+150</span>
                      </div>
                    </div>
                  </div>
                  <div className="vuln-item found">
                    <div className="vuln-status"><span className="status-indicator found">✓</span></div>
                    <div className="vuln-info">
                      <div className="vuln-name">XSS (Stored)</div>
                      <div className="vuln-meta">
                        <span className="severity severity-high">HIGH</span>
                        <span className="points">+100</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 제출 폼 미리보기 */}
              <div className="submit-section">
                <div className="section-header">
                  <span className="icon">📝</span>
                  <h3>SUBMIT VULNERABILITY</h3>
                </div>
                <div className="submit-form">
                  <select className="form-select" disabled>
                    <option>Select vulnerability type...</option>
                  </select>
                  <input className="form-input-field" placeholder="Enter payload or PoC..." readOnly />
                  <button className="submit-btn" disabled>SUBMIT</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (formData.mode === 'FORENSICS_RUSH') {
      return (
        <div className="preview-forensics-rush">
          {/* 게임 흐름 가이드 */}
          <div className="game-flow-guide">
            <div className="flow-title">게임 진행 흐름</div>
            <div className="flow-steps">
              <div className="flow-step completed">
                <span className="step-num">1</span>
                <span className="step-text">브리핑 확인</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step active">
                <span className="step-num">2</span>
                <span className="step-text">증거 분석</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step">
                <span className="step-num">3</span>
                <span className="step-text">질문 답변</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step">
                <span className="step-num">4</span>
                <span className="step-text">사건 해결</span>
              </div>
            </div>
          </div>

          {/* 헤더 - FBI 스타일 */}
          <div className="forensics-header">
            <div className="header-left">
              <span className="agency-badge">DIGITAL FORENSICS</span>
              <h2 className="case-title">Incident Response Case</h2>
              <div className="case-meta">
                <span className="incident-type">DATA BREACH</span>
                <span className="case-date">Case #2024-1130</span>
              </div>
            </div>
            <div className="header-right">
              <div className="stat-card">
                <span className="stat-label">TIME</span>
                <span className="stat-value">15:00</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">SCORE</span>
                <span className="stat-value">0</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">PROGRESS</span>
                <span className="stat-value">0/5</span>
              </div>
            </div>
          </div>

          {/* 시나리오 브리핑 */}
          <div className="scenario-brief">
            <div className="brief-header">
              <span className="brief-title">MISSION BRIEFING</span>
              <span className="classification">CLASSIFIED</span>
            </div>
            <p className="brief-description">
              귀사 서버가 해킹당했습니다. 제공된 증거를 분석하여 공격자를 추적하고 침입 경로를 파악하세요.
            </p>
          </div>

          {/* 작업 공간 */}
          <div className="forensics-workspace">
            {/* 증거 터미널 */}
            <div className="terminal-window evidence-terminal">
              <div className="terminal-header">
                <span className="terminal-title">EVIDENCE FILES</span>
              </div>
              <div className="terminal-body">
                <div className="file-list">
                  <div className="list-header">$ ls /evidence/</div>
                  <div className="file-item selected">
                    <span className="file-icon">[LOG]</span>
                    <span className="file-name">auth.log</span>
                    <span className="flag-badge">KEY</span>
                  </div>
                  <div className="file-item related">
                    <span className="file-icon">[PCAP]</span>
                    <span className="file-name">network.pcap</span>
                  </div>
                  {/* 인라인 힌트 */}
                  <div className="inline-hint">
                    <span className="hint-icon">🔍</span>
                    <span className="hint-text">증거 파일을 분석하여 질문에 답변하세요</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 질문 터미널 */}
            <div className="terminal-window question-terminal">
              <div className="terminal-header">
                <span className="terminal-title">INVESTIGATION QUERIES</span>
              </div>
              <div className="terminal-body">
                <div className="question-content">
                  <div className="question-meta">
                    <span className="q-number">Q1</span>
                    <span className="difficulty-tag diff-easy">EASY</span>
                    <span className="points-tag">50 PTS</span>
                  </div>
                  <div className="question-text">
                    <span className="prompt">&gt;</span>
                    공격자의 IP 주소를 찾으세요
                  </div>
                  <div className="answer-terminal">
                    <div className="terminal-input-line">
                      <span className="input-prompt">ANSWER:</span>
                      <input className="terminal-input" placeholder="Enter your answer..." readOnly />
                    </div>
                  </div>
                </div>
                <div className="questions-nav-terminal">
                  <div className="questions-grid-terminal">
                    <button className="question-chip active">Q1</button>
                    <button className="question-chip">Q2</button>
                    <button className="question-chip solved">Q3</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="arena-create-container">
      {/* 상단 헤더 */}
      <header className="create-header">
        <div className="header-left">
          <div className="header-icon" />
          <h1>{t('createArena')}</h1>
        </div>
        <div className="header-right">
          <div className="step-indicator">
            <div className={`step ${getStepStatus(1)}`}></div>
            <div className={`step ${getStepStatus(2)}`}></div>
            <div className={`step ${getStepStatus(3)}`}></div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="create-main">
        {/* 왼쪽: 미리보기 */}
        <section className="preview-section">
          <div className="preview-header">
            <div className="preview-icon" />
            <h2>Preview</h2>
            {selectedMode && <span className="preview-mode-name">{selectedMode.title}</span>}
          </div>
          {renderPreview()}
        </section>

        {/* 오른쪽: 설정 */}
        <section className="settings-section">
          <div className="settings-header">
            <div className="settings-icon" />
            <h2>Settings</h2>
          </div>

          <form className="settings-form" onSubmit={handleSubmit}>
            {/* 게임 모드 */}
            <div className="form-section">
              <label className="section-label">{t('selectGameMode')}</label>
              <div className="mode-grid">
                {modes.map(mode => (
                  <div
                    key={mode.id}
                    className={`mode-option ${formData.mode === mode.id ? 'selected' : ''} ${mode.disabled ? 'disabled' : ''}`}
                    onClick={() => !mode.disabled && handleModeSelect(mode.id)}
                  >
                    <div className="mode-indicator" />
                    <div className="mode-info">
                      <div className="mode-name">
                        {mode.title}
                        {mode.disabled && ' (Soon)'}
                      </div>
                    </div>
                    <span className="mode-tag">{mode.players}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 난이도 */}
            <div className="form-section">
              <label className="section-label">{t('difficulty')}</label>
              <div className="difficulty-grid">
                {difficulties.map(diff => (
                  <button
                    key={diff.id}
                    type="button"
                    className={`difficulty-option ${formData.difficulty === diff.id ? 'selected' : ''}`}
                    onClick={() => handleDifficultySelect(diff.id)}
                  >
                    {diff.title}
                  </button>
                ))}
              </div>
            </div>

            {/* 방 이름 */}
            <div className="form-section">
              <label className="section-label">{t('arenaName')}</label>
              <input
                type="text"
                name="name"
                className="form-input"
                placeholder={t('enterRoomName')}
                value={formData.name}
                onChange={handleChange}
                maxLength={30}
              />
            </div>

            {/* 참가자 수 */}
            <div className="form-section">
              <label className="section-label">{t('maxParticipants')}</label>
              <input
                type="number"
                name="maxParticipants"
                className="form-input"
                value={formData.maxParticipants}
                onChange={handleChange}
                min={participantsLimit.min}
                max={participantsLimit.max}
                disabled={formData.mode === 'VULNERABILITY_SCANNER_RACE'}
              />
              {formData.mode && (
                <span className="input-hint">
                  {participantsLimit.min === participantsLimit.max
                    ? t('fixedPlayers', { max: participantsLimit.max })
                    : t('rangePlayers', { min: participantsLimit.min, max: participantsLimit.max })
                  }
                </span>
              )}
            </div>

            {/* 에러 */}
            {error && <div className="error-message">{error}</div>}

            {/* 제출 */}
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? t('creating') : t('createArena')}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default AddArenaForm;
