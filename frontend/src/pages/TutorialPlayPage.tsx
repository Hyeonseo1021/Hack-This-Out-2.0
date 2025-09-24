import React, { useState, useMemo } from 'react';
import '../assets/scss/etc/TutorialPlayPage.scss';
import Main from '../components/main/Main';

type StepId = 'connect' | 'spawn' | 'hints' | 'submit';

// 데이터에서 아이콘 정보를 제거하고, title만 사용
const steps = [
  { 
    id: 'connect' as StepId, 
    title: '1. Connect to VPN',
    description: 'VPN 서버에 연결하여 해킹 랩 내부 네트워크에 접속합니다. 연결이 성공하면 가상 IP가 할당됩니다. 이 네트워크를 통해 튜토리얼 머신에 접근할 수 있습니다.'
  },
  { 
    id: 'spawn' as StepId, 
    title: '2. Spawn Machine',
    description: '공격할 대상, 즉 튜토리얼 머신을 생성합니다. 생성 완료 후 나타나는 Target IP를 기록해두세요. 머신은 일정 시간 후에 자동 종료됩니다.'
  },
  { 
    id: 'hints' as StepId, 
    title: '3. Utilize Hints',
    description: '공격 중 막히는 부분이 있다면 힌트를 사용해 보세요. 각 힌트는 유용한 명령, 핵심 개념, 또는 흔히 발생하는 실수에 대한 정보를 제공합니다.'
  },
  { 
    id: 'submit' as StepId, 
    title: '4. Submit The Flag',
    description: '머신의 제어 권한을 획득하고 최종 플래그를 찾았다면, 이곳에 제출하여 튜토리얼을 완료하세요. 플래그는 보통 `FLAG{...}` 형식입니다.'
  },
];

const Play: React.FC = () => {
  const [activeStepId, setActiveStepId] = useState<StepId>('connect');

  const activeStepIndex = useMemo(() => 
    steps.findIndex(step => step.id === activeStepId), 
    [activeStepId]
  );

  const currentStep = steps[activeStepIndex];
  
  const renderAction = () => {
    switch(activeStepId) {
      case 'connect':
        return (
          <>
            <button className="action-button">Download VPN Config</button>
            <div className="info-box">VPN IP: 10.10.X.X (미연결)</div>
          </>
        );
      case 'spawn':
        return (
          <>
            <button className="action-button primary">▶ Spawn Tutorial Machine</button>
            <div className="info-box">Target IP: 10.10.Y.Y (미생성)</div>
            <div className="info-box">남은 시간: --:--:--</div>
          </>
        );
      case 'hints':
        return <button className="action-button">Request Hint (10 EXP)</button>;
      case 'submit':
        return (
          <>
            <input type="text" className="action-input" placeholder="Enter Flag (e.g., FLAG{example_flag})" />
            <button className="action-button primary">Submit Flag</button>
          </>
        );
      default:
        return null;
    }
  }

  return (
    <Main>
      <div className="play-container">
        <div className="play-panel">
          {/* 왼쪽: 단계 내비게이션 */}
          <aside className="step-nav-panel">
            <h1 className="main-title">TUTORIAL</h1>
            <nav className="step-list">
              {steps.map((step, index) => (
                <button 
                  key={step.id} 
                  className={`
                    step-item 
                    ${activeStepId === step.id ? 'active' : ''}
                    ${index < activeStepIndex ? 'completed' : ''}
                  `}
                  onClick={() => setActiveStepId(step.id)}
                  title={step.title}
                >
                  {step.title}
                </button>
              ))}
            </nav>
          </aside>

          {/* 오른쪽: 메인 콘텐츠 영역 (그리드 확장성) */}
          <section className="main-content-area">
            {/* 상단 설명 영역 */}
            <div className="description-section" key={currentStep.id}>
              <h2 className="section-title">{currentStep.title.substring(currentStep.title.indexOf('.') + 1).trim()}</h2>
              <p className="section-description">{currentStep.description}</p>
            </div>

            {/* 하단 액션/정보 영역 (확장성을 위해 div로 분리) */}
            <div className="action-info-section">
              {renderAction()}
            </div>
          </section>
        </div>
      </div>
    </Main>
  );
};

export default Play;