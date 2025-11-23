import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "../../assets/scss/etc/loading.module.scss";

// ✅ 이미지 임포트 (요청하신 7개 프레임을 '순서대로' 무한 반복)
import fullscreenBlack from "../../assets/img/Fullscreen_black.png";
import fullscreen from "../../assets/img/Fullscreen.png";
import screennoise from "../../assets/img/screennoise.png";
import screennoise1 from "../../assets/img/screennoise_1.png";
import screennoise2 from "../../assets/img/screennoise2.png";
import screennoise3 from "../../assets/img/screennoise3.png";
import screennoise4 from "../../assets/img/screennoise4.png";

/**
 * 단일 <img>에 지정한 이미지들을 주기적으로 바꿔 끼우며 "계속 반복"하는 컴포넌트
 * - props.intervalMs: 프레임 전환 간격(ms). 기본 800ms
 * - props.className: 외부에서 스타일 덮어쓰기 원할 때
 */
const Loading: React.FC<{ intervalMs?: number; className?: string }> = ({
  intervalMs = 800,
  className,
}) => {
  const frames = useMemo(
    () => [
      fullscreenBlack,
      fullscreen,
      screennoise,
      screennoise1,
      screennoise2,
      screennoise3,
      screennoise4,
    ],
    []
  );

  const [idx, setIdx] = useState(0);
  const runningRef = useRef<boolean>(!document.hidden);
  const aliveRef = useRef<boolean>(false);
  const timeoutRef = useRef<number | null>(null);

  // ✅ 디버깅: 마운트/언마운트 추적
  useEffect(() => {
    console.log("🔧 Loading mounted");
    return () => console.log("🧹 Loading unmounted");
  }, []);

  // ✅ 이미지 사전 로딩 (깜빡임/지연 최소화)
  useEffect(() => {
    frames.forEach((src) => {
      const img = new Image();
      img.src = src as string;
    });
  }, [frames]);

  // ✅ 가시성 변화에 따른 run 상태 변경 (ref에 저장)
  useEffect(() => {
    const handleVisibility = () => {
      const next = !document.hidden;
      runningRef.current = next;
      console.log("👁️ visibilitychange → running:", next);
      // 가시성 복귀 시 즉시 다음 프레임 스케줄링
      if (next) schedule();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // ✅ setInterval 대신 setTimeout 재귀로 StrictMode 이펙트 이슈 회피
  const schedule = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (!aliveRef.current || !runningRef.current) return;
    timeoutRef.current = window.setTimeout(() => {
      setIdx((prev) => (prev + 1) % frames.length);
      schedule();
    }, intervalMs);
    console.log("⏲️ setTimeout scheduled:", timeoutRef.current, "intervalMs:", intervalMs);
  };

  // ✅ 최초 시작 & 정리 (단일 장소)
  useEffect(() => {
    aliveRef.current = true;
    schedule();
    return () => {
      aliveRef.current = false;
      if (timeoutRef.current) {
        console.log("🧹 clearTimeout:", timeoutRef.current);
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    // intervalMs가 바뀌면 새 주기로 재스케줄
  }, [intervalMs, frames.length]);

  // ✅ 프레임 변화 로그
  useEffect(() => {
    console.log(`🎞 frame → ${idx}, src: ${frames[idx]}`);
  }, [idx, frames]);

  return (
    <div className={className ?? styles.loadingContainer}>
      {/* 단일 이미지에 프레임을 계속 끼워 넣음 */}
      <img
        key={idx}
        src={frames[idx]}
        alt={`loading-frame-${idx}`}
        className={styles.baseImage}
      />

      {/* 필요 시 텍스트 오버레이 유지 */}
      <div className={styles.textOverlay}>
        <h1>HACK</h1>
        <p>THIS OUT 2.0</p>
      </div>
    </div>
  );
};

export default Loading;
