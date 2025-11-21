import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from '../../assets/scss/etc/MainPage.module.scss';

import fullscreenBlack from '../../assets/img/Fullscreen_black.png';
import fullscreen from '../../assets/img/Fullscreen.png';
import screennoise from "../../assets/img/screennoise.png";
import screennoise1 from "../../assets/img/screennoise_1.png";
import screennoise2 from "../../assets/img/screennoise2.png";
import screennoise3 from "../../assets/img/screennoise3.png";
import screennoise4 from "../../assets/img/screennoise4.png";

interface MainPageProps {
  intervalMs?: number;
  className?: string;
}

const MainPage: React.FC<MainPageProps> = ({
  intervalMs = 40, // ✅ 더 빠른 노이즈 전환 속도
  className = '',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  const noiseFrames = [screennoise, screennoise1, screennoise2, screennoise3, screennoise4];
  const [currentImage, setCurrentImage] = useState(fullscreenBlack);
  const [glitchIntensity, setGlitchIntensity] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isFirstPhase, setIsFirstPhase] = useState(true);

  const handleTransition = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      navigate('/manual');
    }, 400);
  };

  useEffect(() => {
    const handleKeyPress = () => handleTransition();
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

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
          setCurrentImage(noiseFrames[noiseIndex % noiseFrames.length]);
          setGlitchIntensity(Math.random() * 0.8 + 0.3);
          noiseIndex++;
        }, intervalMs);

        // 노이즈 끝 → 다시 fullscreen
        setTimeout(() => {
          clearInterval(noiseInterval);
          setCurrentImage(fullscreen);
          setGlitchIntensity(0);
          setTimeout(startLoop, 1200); // 루프 간격 짧게
        }, 1200);
      }, 800); // ✅ fullscreen 유지 짧게 (빠른 노이즈 진입)
    };

    startLoop();
    return () => {
      clearTimeout(mainTimer);
      clearInterval(noiseInterval);
    };
  }, [intervalMs, isFirstPhase]);

  useEffect(() => {
    if (location.state?.fromLogin) {
      const timer = setTimeout(() => handleTransition(), 6000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const handleClick = () => handleTransition();

  const style = {
    backgroundImage: `url(${currentImage})`,
    filter: `contrast(${1 + glitchIntensity * 0.3}) brightness(${1 + glitchIntensity * 0.2})`,
    transition: 'background-image 0.1s ease-in-out, filter 0.08s ease-in-out',
  };

  return (
    <div
      ref={containerRef}
      style={style}
      onClick={handleClick}
      className={`
        ${styles.glitch}
        ${className}
        ${isFadingOut ? styles.fadeOut : ''}
      `}
    >
      {/* RGB 채널 왜곡 */}
      <div className={`${styles.channel} ${styles.r}`} style={{ opacity: 0.3 + glitchIntensity * 0.5 }}></div>
      <div className={`${styles.channel} ${styles.g}`} style={{ opacity: 0.3 + glitchIntensity * 0.5 }}></div>
      <div className={`${styles.channel} ${styles.b}`} style={{ opacity: 0.3 + glitchIntensity * 0.5 }}></div>

      {/* 스크린 노이즈 오버레이 */}
      <div className={styles.noise} style={{ opacity: 0.25 + glitchIntensity * 0.5 }}></div>
    </div>
  );
};

export default MainPage;
