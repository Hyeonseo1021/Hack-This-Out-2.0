import React, { useState, useCallback } from 'react';
import '../assets/scss/etc/ManualPage.scss';
import Main from '../components/main/Main';
import '../assets/scss/etc/PlayPage.scss';

// 배경 패널 이미지
import panelLeft from '../assets/img/play2.png';  // 세로형(왼쪽 메뉴)
import panelRight from '../assets/img/play1.png'; // 가로형(오른쪽 메인)

type Step = 'connect' | 'spawn' | 'hints' | 'submit';

const Play: React.FC = () => {
  const [activeStep, setActiveStep] = useState<Step>('connect');

  // 키보드 ↑/↓로 단계 이동
  const onKeyNav = useCallback((e: React.KeyboardEvent) => {
    const order: Step[] = ['connect', 'spawn', 'hints', 'submit'];
    const idx = order.indexOf(activeStep);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveStep(order[Math.min(idx + 1, order.length - 1)]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveStep(order[Math.max(idx - 1, 0)]);
    }
  }, [activeStep]);

  const StepContent = () => {
    switch (activeStep) {
      case 'connect':
        return (
          <>
            <h2 className="play-right-title">Connect</h2>
            <p className="play-right-text">
              VPN 설정 파일을 다운로드하고 클라이언트로 접속하세요.
              연결 후 할당된 <strong>VPN IP</strong>를 확인합니다.
            </p>
          </>
        );
      case 'spawn':
        return (
          <>
            <h2 className="play-right-title">Spawn Machine</h2>
            <p className="play-right-text">
              튜토리얼 머신을 생성한 뒤 표시되는 <strong>Target IP</strong>를 기록하세요.
              핑/포트스캔 등 기본 점검을 진행합니다.
            </p>
          </>
        );
      case 'hints':
        return (
          <>
            <h2 className="play-right-title">Hints</h2>
            <p className="play-right-text">
              막히면 힌트를 확인하세요. 핵심 개념, 유용한 명령, 흔한 함정을 제공합니다.
            </p>
          </>
        );
      case 'submit':
        return (
          <>
            <h2 className="play-right-title">Submit Flag</h2>
            <p className="play-right-text">
              획득한 플래그를 제출하면 튜토리얼이 완료됩니다. 형식에 유의하세요.
            </p>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Main>
      <div className="play-viewport">
        {/* 상단 타이틀 */}
        <h1 className="play-title">Tutorial Machine</h1>

        {/* 작업 캔버스(16:9) */}
        <div
          className="play-canvas"
          style={
            {
              ['--left-url' as any]: `url(${panelLeft})`,
              ['--right-url' as any]: `url(${panelRight})`,
            }
          }
        >
          {/* 왼쪽 패널(배경 + 단계 버튼) */}
          <aside className="play-left">
            <nav className="play-steps" aria-label="Tutorial steps" onKeyDown={onKeyNav}>
              <button
                className={`play-step ${activeStep === 'connect' ? 'active' : ''}`}
                data-step="connect"
                onClick={() => setActiveStep('connect')}
                aria-selected={activeStep === 'connect'}
                aria-current={activeStep === 'connect' ? 'step' : undefined}
                tabIndex={0}
              >
                connect
              </button>

              <button
                className={`play-step ${activeStep === 'spawn' ? 'active' : ''}`}
                data-step="spawn"
                onClick={() => setActiveStep('spawn')}
                aria-selected={activeStep === 'spawn'}
                aria-current={activeStep === 'spawn' ? 'step' : undefined}
                tabIndex={0}
              >
                spawn Machine
              </button>

              <button
                className={`play-step ${activeStep === 'hints' ? 'active' : ''}`}
                data-step="hints"
                onClick={() => setActiveStep('hints')}
                aria-selected={activeStep === 'hints'}
                aria-current={activeStep === 'hints' ? 'step' : undefined}
                tabIndex={0}
              >
                Hints
              </button>

              <button
                className={`play-step ${activeStep === 'submit' ? 'active' : ''}`}
                data-step="submit"
                onClick={() => setActiveStep('submit')}
                aria-selected={activeStep === 'submit'}
                aria-current={activeStep === 'submit' ? 'step' : undefined}
                tabIndex={0}
              >
                submit Flag
              </button>
            </nav>
          </aside>

          {/* 오른쪽 메인 패널(배경 위 컨텐츠) */}
          <section className="play-right" aria-label="Machine panel">
            <div className="play-right-inner">
              <StepContent />
            </div>
          </section>
        </div>
      </div>
    </Main>
  );
};

export default Play;