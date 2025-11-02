import React, { useEffect, useState } from "react";
import styles from "../../assets/scss/etc/loading.module.scss";
import fullscreenBlack from "../../assets/img/Fullscreen_black.png";
import fullscreen from "../../assets/img/Fullscreen.png";
import screennoise from "../../assets/img/screennoise.png";
import screennoise1 from "../../assets/img/screennoise_L.png";
import screennoise2 from "../../assets/img/screennoise2.png";
import screennoise3 from "../../assets/img/screennoise3.png";
import screennoise4 from "../../assets/img/screennoise4.png";

const baseImages = [fullscreenBlack, fullscreen];
const noiseFrames = [screennoise, screennoise1, screennoise2, screennoise3, screennoise4];

const Loading: React.FC = () => {
  const [baseIndex, setBaseIndex] = useState(0);
  const [noiseIndex, setNoiseIndex] = useState(0);

  // ✅ 배경 전환
  useEffect(() => {
    const baseTimer = setInterval(() => {
      setBaseIndex((prev) => (prev + 1) % baseImages.length);
    }, 5000);
    return () => clearInterval(baseTimer);
  }, []);

  // ✅ 노이즈 순환
  useEffect(() => {
    const noiseTimer = setInterval(() => {
      setNoiseIndex((prev) => (prev + 1) % noiseFrames.length);
    }, 120);
    return () => clearInterval(noiseTimer);
  }, []);

  return (
    <div className={styles.loadingContainer}>
      {/* --- 배경 --- */}
      <img src={baseImages[baseIndex]} alt="base" className={styles.baseImage} />

      {/* --- 노이즈 오버레이 --- */}
      <img src={noiseFrames[noiseIndex]} alt="noise" className={styles.noiseOverlay} />

      {/* --- 텍스트 --- */}
      <div className={styles.textOverlay}>
        <h1>HACK</h1>
        <p>THIS OUT 2.0</p>
      </div>
    </div>
  );
};

export default Loading;