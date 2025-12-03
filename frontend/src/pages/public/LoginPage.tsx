import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../assets/scss/etc/MainPage.module.scss';

import LoginForm from '../../components/login/LoginForm';
import RegisterForm from '../../components/login/RegisterForm';
import Modal from '../../components/modal/Modal';
import Loading from '../../components/public/Loading';

import { AuthUserContext } from '../../contexts/AuthUserContext';

import fullscreenBlack from '../../assets/img/Fullscreen_black.png';
import fullscreen from '../../assets/img/Fullscreen.png';
import screennoise from "../../assets/img/screennoise.png";
import screennoise1 from "../../assets/img/screennoise_1.png";
import screennoise2 from "../../assets/img/screennoise2.png";
import screennoise3 from "../../assets/img/screennoise3.png";
import screennoise4 from "../../assets/img/screennoise4.png";

interface LoginPageProps {
  intervalMs?: number;
}

const LoginPage: React.FC<LoginPageProps> = ({ intervalMs = 40 }) => {
  const navigate = useNavigate();
  const { isLoggedIn, isLoading } = useContext(AuthUserContext)!;

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const noiseFrames = useRef([screennoise, screennoise1, screennoise2, screennoise3, screennoise4]);
  const [currentImage, setCurrentImage] = useState(fullscreenBlack);
  const [glitchIntensity, setGlitchIntensity] = useState(0);
  const [isFirstPhase, setIsFirstPhase] = useState(true);

  useEffect(() => {
    if (!isLoading && isLoggedIn) navigate('/');
  }, [isLoggedIn, isLoading, navigate]);

  useEffect(() => {
    let noiseIndex = 0;
    let mainTimer: NodeJS.Timeout;
    let noiseInterval: NodeJS.Timeout;

    const startLoop = () => {
      // 첫 화면: fullscreen_black → fullscreen
      if (isFirstPhase) {
        setCurrentImage(fullscreenBlack);
        setTimeout(() => setCurrentImage(fullscreen), 400);
        mainTimer = setTimeout(() => {
          setIsFirstPhase(false);
          startLoop();
        }, 1000);
        return;
      }

      // 일반 루프
      setCurrentImage(fullscreen);
      mainTimer = setTimeout(() => {
        noiseInterval = setInterval(() => {
          setCurrentImage(noiseFrames.current[noiseIndex % noiseFrames.current.length]);
          setGlitchIntensity(Math.random() * 0.8 + 0.3);
          noiseIndex++;
        }, intervalMs);

        // 노이즈 끝 → 다시 fullscreen
        setTimeout(() => {
          clearInterval(noiseInterval);
          setCurrentImage(fullscreen);
          setGlitchIntensity(0);
          setTimeout(startLoop, 1200);
        }, 1200);
      }, 800);
    };

    startLoop();
    return () => {
      clearTimeout(mainTimer);
      clearInterval(noiseInterval);
    };
  }, [intervalMs, isFirstPhase]);

  const style = {
    backgroundImage: `url(${currentImage})`,
    filter: `contrast(${1 + glitchIntensity * 0.3}) brightness(${1 + glitchIntensity * 0.2})`,
    transition: 'background-image 0.1s ease-in-out, filter 0.08s ease-in-out',
  };

  // 로딩 중일 때는 Loading 컴포넌트 표시
  if (isLoading) {
    return <Loading />;
  }

  return (
    <>
      {/* MainPage와 동일한 글리치 배경 */}
      <div
        ref={containerRef}
        style={style}
        onClick={() => setShowLoginModal(true)}
        className={styles.glitch}
      >
        {/* RGB 채널 왜곡 */}
        <div className={`${styles.channel} ${styles.r}`} style={{ opacity: 0.3 + glitchIntensity * 0.5 }}></div>
        <div className={`${styles.channel} ${styles.g}`} style={{ opacity: 0.3 + glitchIntensity * 0.5 }}></div>
        <div className={`${styles.channel} ${styles.b}`} style={{ opacity: 0.3 + glitchIntensity * 0.5 }}></div>

        {/* 스크린 노이즈 오버레이 */}
        <div className={styles.noise} style={{ opacity: 0.25 + glitchIntensity * 0.5 }}></div>
      </div>

      {/* 로그인 모달 */}
      <Modal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)}>
        <LoginForm openRegisterModal={() => {
          setShowLoginModal(false);
          setShowRegisterModal(true);
        }} />
      </Modal>

      {/* 회원가입 모달 */}
      <Modal isOpen={showRegisterModal} onClose={() => setShowRegisterModal(false)}>
        <RegisterForm closeRegisterModal={() => setShowRegisterModal(false)} />
      </Modal>
    </>
  );
};

export default LoginPage;
