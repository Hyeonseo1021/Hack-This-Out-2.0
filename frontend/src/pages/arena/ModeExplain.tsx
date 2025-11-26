import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Main from '../../components/main/Main';
import '../../assets/scss/arena/ModeExplain.scss';

const modes = [
  {
    id: 'TERMINAL_HACKING_RACE',
    title: 'Terminal Race',
    desc: { ko: '터미널 명령어로 가장 빠르게 해킹', en: 'Hack fastest using terminal commands' },
    players: { ko: '2-8명', en: '2-8 players' },
    description: { ko: '터미널 명령어를 활용하여 가장 빠르게 문제를 해결하는 레이스 모드입니다.', en: 'A race mode where you solve problems fastest using terminal commands.' },
    objective: { ko: '주어진 시스템에서 플래그를 찾거나 특정 작업을 가장 빨리 완료하세요.', en: 'Find the flag or complete specific tasks as fast as possible.' },
    rules: {
      ko: [
        '각 참가자는 동일한 시스템 환경에서 시작합니다',
        '터미널 명령어만 사용하여 문제를 해결해야 합니다',
        '가장 먼저 목표를 달성한 플레이어가 승리합니다',
        '잘못된 명령어 사용 시 페널티가 부여될 수 있습니다'
      ],
      en: [
        'All participants start in the same system environment',
        'You must solve problems using only terminal commands',
        'The first player to achieve the goal wins',
        'Incorrect commands may result in penalties'
      ]
    },
    tutorialPath: '/tutorial/arena/terminal'
  },
  {
    id: 'VULNERABILITY_SCANNER_RACE',
    title: 'Vulnerability Scanner Race',
    desc: { ko: '웹 애플리케이션의 취약점을 찾아내라', en: 'Find vulnerabilities in web applications' },
    players: { ko: '2명', en: '2 players' },
    description: { ko: '시스템의 취약점을 스캔하고 분석하여 가장 많은 취약점을 찾는 경쟁 모드입니다.', en: 'A competitive mode where you scan and analyze to find the most vulnerabilities.' },
    objective: { ko: '제한 시간 내에 가장 많은 보안 취약점을 찾아내세요.', en: 'Find as many security vulnerabilities as possible within the time limit.' },
    rules: {
      ko: [
        '다양한 스캐닝 도구를 활용할 수 있습니다',
        '발견한 취약점의 심각도에 따라 점수가 부여됩니다',
        '잘못된 탐지(False Positive)는 점수에서 차감됩니다',
        '가장 높은 점수를 획득한 플레이어가 승리합니다'
      ],
      en: [
        'You can use various scanning tools',
        'Points are awarded based on vulnerability severity',
        'False positives will deduct points',
        'The player with the highest score wins'
      ]
    },
    tutorialPath: '/tutorial/arena/vulnerability'
  },
  {
    id: 'FORENSICS_RUSH',
    title: 'Forensics Rush',
    desc: { ko: '증거를 분석하고 범인을 찾아내라', en: 'Analyze evidence and find the culprit' },
    players: { ko: '2-8명', en: '2-8 players' },
    description: { ko: '디지털 포렌식 기술을 활용하여 증거를 찾고 분석하는 모드입니다.', en: 'A mode where you find and analyze evidence using digital forensics.' },
    objective: { ko: '숨겨진 데이터와 증거를 찾아 사건을 해결하세요.', en: 'Find hidden data and evidence to solve the case.' },
    rules: {
      ko: [
        '파일 시스템, 네트워크 로그, 메모리 덤프 등을 분석합니다',
        '각 증거마다 점수가 부여됩니다',
        '올바른 분석 결과를 제출해야 점수를 획득합니다',
        '제한 시간 내에 가장 많은 증거를 찾은 플레이어가 승리합니다'
      ],
      en: [
        'Analyze file systems, network logs, memory dumps, etc.',
        'Points are awarded for each piece of evidence',
        'You must submit correct analysis to earn points',
        'The player who finds the most evidence within the time limit wins'
      ]
    },
    tutorialPath: '/tutorial/arena/forensics'
  },
  {
    id: 'SOCIAL_ENGINEERING_CHALLENGE',
    title: 'Social Engineering',
    desc: { ko: 'AI를 속여 정보를 빼내는 심리전', en: 'A psychological battle to extract info from AI' },
    players: { ko: '1-4명', en: '1-4 players' },
    description: { ko: '소셜 엔지니어링 기법을 활용하여 정보를 획득하는 챌린지 모드입니다.', en: 'A challenge mode where you obtain information using social engineering techniques.' },
    objective: { ko: '다양한 소셜 엔지니어링 기법으로 목표 정보를 획득하세요.', en: 'Obtain target information using various social engineering techniques.' },
    rules: {
      ko: [
        '이메일 피싱, 프리텍스팅 등 다양한 기법을 사용합니다',
        '윤리적 해킹 규칙을 준수해야 합니다',
        '획득한 정보의 중요도에 따라 점수가 부여됩니다',
        '가장 높은 점수를 획득한 플레이어가 승리합니다'
      ],
      en: [
        'Use various techniques like email phishing, pretexting, etc.',
        'You must follow ethical hacking rules',
        'Points are awarded based on the importance of obtained information',
        'The player with the highest score wins'
      ]
    },
    tutorialPath: '/tutorial/arena/social'
  },
];

const ModeExplain: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "ko">("en");

  const handleModeSelect = (modeId: string) => {
    setSelectedMode(modeId);
  };

  const toggleLanguage = () => setLanguage((prev) => (prev === "en" ? "ko" : "en"));

  const currentMode = selectedMode ? modes.find(m => m.id === selectedMode) : null;

  return (
    <Main>
      <div className="arena-create-container">
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '10px', width: '100%', maxWidth: '1400px' }}>
          <h1 style={{ textAlign: 'center', margin: 0 }}>{language === "en" ? "Game Mode Explanation" : "게임 모드 설명"}</h1>
          <button className="lang-toggle" onClick={toggleLanguage} style={{ position: 'absolute', right: '50px' }}>
            {language === "en" ? "🇺🇸 EN" : "🇰🇷 KR"}
          </button>
        </div>

        <div className="arena-grid-layout">
          {/* 왼쪽: 모드 선택 */}
          <div className="card mode-selector">
            <h2 className="card-title">{language === "en" ? "Select Game Mode" : "게임 모드 선택"}</h2>
            <div className="card-content">
              <div className="mode-list">
                {modes.map(mode => (
                  <div
                    key={mode.id}
                    className={`mode-card ${selectedMode === mode.id ? 'selected' : ''}`}
                    onClick={() => handleModeSelect(mode.id)}
                  >
                    <h3 className="mode-title">{mode.title}</h3>
                    <p className="mode-desc">{mode.desc[language]}</p>
                    <span className="mode-players">{mode.players[language]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 오른쪽: 모드 상세 설명 */}
          {currentMode ? (
            <div className="card settings-card mode-detail-card">
              <h2 className="card-title">{currentMode.title}</h2>
              <div className="card-content">
                <div className="mode-description-section" style={{ marginTop: 0, padding: 0, border: 'none', boxShadow: 'none', background: 'transparent' }}>
                  <div className="mode-desc-content" style={{ gap: '20px' }}>
                    <div className="mode-desc-objective" style={{ marginBottom: '20px' }}>
                      <h4>{language === "en" ? "Mission Objective" : "미션 목표"}</h4>
                      <p>{currentMode.objective[language]}</p>
                    </div>

                    <div className="mode-desc-block">
                      <h4>{language === "en" ? "Description" : "설명"}</h4>
                      <p>{currentMode.description[language]}</p>
                    </div>

                    <div className="mode-desc-block">
                      <h4>{language === "en" ? "Rules" : "규칙"}</h4>
                      <ul>
                        {currentMode.rules[language].map((rule, index) => (
                          <li key={index}>{rule}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <button
                  className="submit-button"
                  onClick={() => navigate(currentMode.tutorialPath)}
                  style={{ marginTop: '30px' }}
                >
                  <span>{language === "en" ? "Start Tutorial" : "튜토리얼 시작"}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="card settings-card placeholder-card">
              <div className="card-content">
                <div className="placeholder-content">
                  <div className="placeholder-icon">ℹ️</div>
                  <h2>{language === "en" ? "Select a Game Mode" : "게임 모드를 선택하세요"}</h2>
                  <p>{language === "en" ? "Click on any game mode to view detailed information" : "게임 모드를 클릭하여 자세한 정보를 확인하세요"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Main>
  );
};

export default ModeExplain;
