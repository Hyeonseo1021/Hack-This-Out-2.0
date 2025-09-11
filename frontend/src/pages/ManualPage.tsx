import React, { useState } from 'react';
import '../assets/scss/etc/ManualPage.scss';
import Main from '../components/main/Main';
import { Link } from 'react-router-dom';

import frameImg from '../assets/img/Group 88.png';
import vec1 from '../assets/img/vector1.png';
import vec2 from '../assets/img/vector2.png';
import vec3 from '../assets/img/vector3.png';
import vec4 from '../assets/img/vector4.png';

const ManualPage: React.FC = () => {
  const [language, setLanguage] = useState<'ko' | 'en'>('ko');

  const textMap = {
    ko: { manual: 'MANUAL', Guide: '게임 규칙', tutorial: '튜토리얼', v1: '게임 소개', v2: '게임 모드' },
    en: { manual: 'MANUAL', Guide: 'Guide',     tutorial: 'Tutorial',  v1: 'Game Intro', v2: 'Game Mode' },
  } as const;

  const toggleLanguage = () => setLanguage(prev => (prev === 'ko' ? 'en' : 'ko'));

  return (
    <Main>
      <div className="manual-viewport">
        <div
          className="manual-border-frame glitch"
          style={{
            backgroundImage: `url(${frameImg})`,
            ['--frame-url' as any]: `url(${frameImg})`,
          }}
        >
          <div className="frame-inner">
            {/* 라벨 */}
            <div className="label manual-title">{textMap[language].manual}</div>
            <div className="label guide-title">
              {language === 'ko' ? '게임 규칙' : 'Guide'}
            </div>

            {/* 언어 토글 */}
            <button className="language-toggle" onClick={toggleLanguage}>
              {language === 'ko' ? 'English' : '한국어'}
            </button>

            {/* 벡터(장식) */}
            <img className="vector v1" src={vec1} alt="" aria-hidden="true" />
            <img className="vector v2" src={vec2} alt="" aria-hidden="true" />
            <img className="vector v3" src={vec3} alt="" aria-hidden="true" />
            <img className="vector v4" src={vec4} alt="" aria-hidden="true" />


            {/* 게임 규칙 */}
            <div className="Guide">
              <h3>{language === 'ko' ? '게임 규칙' : 'Guide'}</h3>
              <ol>
                <li>{language === 'ko' ? '해킹을 통해 깃발을 획득하여 머신을 완료합니다.' : 'Hack the machine to capture the flag and complete it.'}</li>
                <li>{language === 'ko' ? '머신을 완료하면 경험치(EXP)를 얻습니다.' : 'Earn experience (EXP) upon completing the machine.'}</li>
                <li>{language === 'ko' ? '각 머신에서 힌트를 얻을 수 있지만, 페널티가 부과됩니다.' : 'Hints can be obtained in each machine, but penalties apply.'}</li>
              </ol>
            </div>

            {/* 좌측 박스 텍스트 */}
            <div className="box-label v1">{textMap[language].v1}</div>
            <div className="box-label v2">{textMap[language].v2}</div>

            {/* 게임 소개 박스 전체 클릭 핫스팟 → /tutorial (그대로) */}
            <Link
              to="/tutorial"
              className="hotspot v1"
              aria-label={language === 'ko' ? '튜토리얼로 이동' : 'Go to Tutorial'}
            />

            <Link
              to="/play"
              className="tutorial-cta"
              aria-label={language === 'ko' ? 'Play 페이지로 이동': 'Go to Play page'}
            >
              {textMap[language].tutorial}
            </Link>
          </div>
        </div>
      </div>
    </Main>
  );
};

export default ManualPage;
