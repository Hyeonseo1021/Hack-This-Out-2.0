import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Main from '../components/main/Main';
import '../assets/scss/etc/TutorialPage.scss';
import logo_dark from '../assets/img/icon/HTO Dark.png';
import logo_light from '../assets/img/icon/HTO Light.png';

const TutorialPage: React.FC = () => {
  const { i18n } = useTranslation('tutorial');
  const [step, setStep] = useState(0);
  const [isGlitch, setIsGlitch] = useState(false);

  const isKo = i18n.language === 'ko';

  const handleChangeLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ko' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
    setIsGlitch(true);
    setTimeout(() => setIsGlitch(false), 500);
  };

  const articleClass = (index: number) =>
    `tutorial-article ${step === index ? 'active' : step > index ? 'passed' : ''}`;

  const handleNext = () => {
    if (step < 3) setStep(prev => prev + 1);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Main>
      <div className="tutorial-page-container" onClick={handleNext}>
        <div className="tutorial-page-top">
          <img
            className={`tutorial-banner ${isGlitch ? 'glitch-flash' : ''}`}
            src={i18n.language === 'en' ? logo_dark : logo_light}
            alt="HTO Banner"
            onClick={(e) => {
              e.stopPropagation();
              handleChangeLanguage();
            }}
            style={{ cursor: 'pointer' }}
          />
        </div>

        <section className="tutorial-page-content-container">
          <article className={articleClass(0)}>
            <h2>{isKo ? '소개' : 'Introduction'}</h2>
            <p>
              {isKo ? (
                <>
                  <strong>Hack This Out</strong>은 웹 기반 <strong>해킹 랩</strong>입니다.<br />
                  정보 보안은 어렵고 지루하지만, 저희는 <strong>재미</strong>있고 <strong>흥미진진</strong>할 수 있다고 생각합니다.<br />
                  정보보안의 여정은 <strong>험난</strong>하고 <strong>어려울</strong> 것입니다.<br />
                  그래서, 저희는 여러분의 여정을 위해 <strong>게임형 경험</strong>을 준비했습니다.
                </>
              ) : (
                <>
                  <strong>Hack This Out</strong> is a web-based <strong>Hacking Lab</strong>.<br />
                  Cyber Security is hard and boring, but we believe that it can be <strong>Fun</strong> and <strong>Exciting</strong>.<br />
                  The journey will be <strong>Rough</strong> and <strong>Exhausting</strong>.<br />
                  So, we prepared <strong>Gaming experience</strong> for your fun and exciting journey.
                </>
              )}
            </p>
          </article>

          <article className={articleClass(1)}>
            <h2>{isKo ? '게임 규칙' : 'Gaming Rules'}</h2>
            <ol>
              <li>{isKo ? '플레이어 간의 배려를 유지해주세요.' : 'Please maintain respect between players.'}</li>
              <li>{isKo ? '저희 사이트는 모의 해킹 플랫폼입니다. 그 외 사용은 삼가해주세요.' : 'This site is a simulated hacking platform. Please refrain from other uses.'}</li>
              <li>{isKo ? '저희 사이트를 개개인의 역량껏 사용 바랍니다.' : 'Please use our site to the best of your abilities.'}</li>
            </ol>
          </article>

          <article className={articleClass(2)}>
            <h2>{isKo ? '게임 모드' : 'Game Modes'}</h2>
            <p>
              {isKo ? (
                <>
                  <strong>머신</strong><br />
                  기본 모드! 취약한 머신을 해킹해야 합니다.<br />
                  <strong>깃발</strong>을 찾아 머신을 완료하세요.<br /><br />
                  <strong>컨테스트</strong><br />
                  경쟁 모드! 다른 플레이어와 경쟁하세요.<br />
                  각 컨테스트에는 <strong>기간</strong>이 있습니다.<br />
                  기간 내에 모든 주어진 머신들을 가장 빨리 완료한 플레이어가 <strong>승리</strong>합니다.
                </>
              ) : (
                <>
                  <strong>Machine</strong><br />
                  The Basic! You have to hack vulnerable machines.<br />
                  Find the <strong>Flag</strong> and complete the machine.<br /><br />
                  <strong>Contest</strong><br />
                  The Competition! Compete against other players.<br />
                  Each contest has a <strong>Period</strong>.<br />
                  The <strong>Quickest</strong> player who completes all given tasks in the period, gets to <strong>Win</strong>.
                </>
              )}
            </p>
          </article>

          <article className={articleClass(3)}>
            <div className="tutorial-video-container">
              <h3>{isKo ? '튜토리얼 영상' : 'Tutorial Video'}</h3>
              <iframe
                width="560"
                height="315"
                src="https://www.youtube.com/embed/videoseries?si=kgEJ4ZhlcCpcSSF6&amp;list=PLUK26CwhrfoZVjnUkSWtrds8nvh4VUY59"
                title="HTO Tutorial Playlist"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              ></iframe>
            </div>
          </article>

          {step < 3 && <div className="tutorial-hint">{isKo ? '클릭하여 계속...' : 'Click anywhere to continue...'}</div>}
        </section>
      </div>
    </Main>
  );
};

export default TutorialPage;