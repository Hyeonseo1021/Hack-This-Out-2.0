import React, { useState } from 'react';
import '../assets/scss/etc/ManualPage.scss';
import Main from '../components/main/Main';
import { Link } from 'react-router-dom';

import frameImg from '../assets/img/Group 88.png'; // 테두리 PNG
import vec1 from '../assets/img/vector1.png';
import vec2 from '../assets/img/vector2.png';
import vec3 from '../assets/img/vector3.png';
import vec4 from '../assets/img/vector4.png';

const ManualPage: React.FC = () => {
  const [language, setLanguage] = useState<'ko' | 'en'>('ko');

  // ✅ 언어별 텍스트 (guide → rules 로 변경)
  const textMap = {
    ko: { manual: 'MANUAL', Guide: '게임 규칙', tutorial: '튜토리얼', v1: '게임 소개', v2: '게임 모드' },
    en: { manual: 'MANUAL', Guide: 'Guide', tutorial: 'Tutorial',  v1: 'Game Intro', v2: 'Game Mode' },
  } as const;

  const toggleLanguage = () => setLanguage(prev => (prev === 'ko' ? 'en' : 'ko'));

  return (
    <Main>
      <div className="manual-viewport">
        {/* 프레임 + 글리치 */}
        <div
          className="manual-border-frame glitch"
          style={{
            backgroundImage: `url(${frameImg})`,
            ['--frame-url' as any]: `url(${frameImg})`,
          }}
        >
          <div className="frame-inner">
            {/* ===== 라벨 ===== */}
            <div className="label manual-title">{textMap[language].manual}</div>
            {/* ✅ 중앙 상단 라벨: 게임 규칙 / Game Rules */}
            <div className="label rules-title">{textMap[language].Guide}</div>

            {/* ===== 언어 토글 ===== */}
            <button className="language-toggle" onClick={toggleLanguage}>
              {language === 'ko' ? 'English' : '한국어'}
            </button>

            {/* ===== 데코 벡터(좌2, 중앙, 우1) ===== */}
            <img className="vector v1" src={vec1} alt="" aria-hidden="true" />
            <img className="vector v2" src={vec2} alt="" aria-hidden="true" />
            <img className="vector v3" src={vec3} alt="" aria-hidden="true" />
            <img className="vector v4" src={vec4} alt="" aria-hidden="true" />

            {/* ✅ 벡터1/2 안 텍스트 */}
            <div className="box-label v1">{textMap[language].v1}</div>
            <div className="box-label v2">{textMap[language].v2}</div>

            {/* ===== 하단 Tutorial CTA (언어 연동) ===== */}
            <Link to="/tutorial" className="tutorial-cta">
              {textMap[language].tutorial}
            </Link>
          </div>
        </div>
      </div>
    </Main>
  );
};

export default ManualPage;
