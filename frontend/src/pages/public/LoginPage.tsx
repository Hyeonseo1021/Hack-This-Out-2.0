import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../assets/scss/login/LoginPage.scss';

import LoginForm from '../../components/login/LoginForm';
import RegisterForm from '../../components/login/RegisterForm';
import Modal from '../../components/modal/Modal';

import { AuthUserContext } from '../../contexts/AuthUserContext';

// 🔥 MainPage 이미지/노이즈 로직
import fullscreenBlack from '../../assets/img/Fullscreen_black.png';
import fullscreen from '../../assets/img/Fullscreen.png';
import screennoise from "../../assets/img/screennoise.png";
import screennoise1 from "../../assets/img/screennoise_1.png";
import screennoise2 from "../../assets/img/screennoise2.png";
import screennoise3 from "../../assets/img/screennoise3.png";
import screennoise4 from "../../assets/img/screennoise4.png";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, isLoading } = useContext(AuthUserContext)!;

  const [showLoginModal, setShowLoginModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 🔥 MainPage 루프 그대로
  const noiseFrames = [screennoise, screennoise1, screennoise2, screennoise3, screennoise4];
  const [currentImage, setCurrentImage] = useState(fullscreenBlack);
  const [glitchIntensity, setGlitchIntensity] = useState(0);
  const [isFirstPhase, setIsFirstPhase] = useState(true);

  useEffect(() => {
    if (!isLoading && isLoggedIn) navigate('/');
  }, [isLoggedIn, isLoading]);

  useEffect(() => {
    let index = 0;
    let mainTimer: NodeJS.Timeout;
    let noiseInterval: NodeJS.Timeout;

    const loop = () => {
      if (isFirstPhase) {
        setCurrentImage(fullscreenBlack);

        setTimeout(() => setCurrentImage(fullscreen), 400);

        mainTimer = setTimeout(() => {
          setIsFirstPhase(false);
          loop();
        }, 1000);

        return;
      }

      setCurrentImage(fullscreen);

      mainTimer = setTimeout(() => {
        noiseInterval = setInterval(() => {
          setCurrentImage(noiseFrames[index % noiseFrames.length]);
          setGlitchIntensity(Math.random() * 0.8 + 0.3);
          index++;
        }, 40);

        setTimeout(() => {
          clearInterval(noiseInterval);
          setCurrentImage(fullscreen);
          setGlitchIntensity(0);

          setTimeout(loop, 1200);
        }, 1200);
      }, 800);
    };

    loop();

    return () => {
      clearInterval(noiseInterval);
      clearTimeout(mainTimer);
    };
  }, []);

  // 🔥 배경 스타일
  const style = {
    backgroundImage: `url(${currentImage})`,
    filter: `contrast(${1 + glitchIntensity * 0.3}) brightness(${1 + glitchIntensity * 0.2})`,
  };

  return (
    <div className="login-root">
      
      {/* 🔥 전체 배경 */}
      <div
        ref={containerRef}
        className={`background-image ${showLoginModal ? 'scaled' : ''}`}
        style={style}
        onClick={() => setShowLoginModal(true)}
      >
        {/* 🔥 RGB 채널 (넣어달라고 한 부분) */}
        <div className="channel r" style={{ opacity: 0.3 + glitchIntensity * 0.5 }} />
        <div className="channel g" style={{ opacity: 0.3 + glitchIntensity * 0.5 }} />
        <div className="channel b" style={{ opacity: 0.3 + glitchIntensity * 0.5 }} />

        {/* 🔥 노이즈 오버레이 */}
        <div className="noise" style={{ opacity: 0.25 + glitchIntensity * 0.5 }} />
      </div>

      {/* 🔥 로그인 모달 */}
      <Modal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)}>
        <LoginForm openRegisterModal={() => {}} />
      </Modal>
    </div>
  );
};

export default LoginPage;
