import React, { useState } from "react";
import "../../assets/scss/Shop/Roulette.scss";
import { spinRoulette } from "../../api/axiosShop";

import hint1Img from "../../assets/img/shop/hint1.png";
import hint3Img from "../../assets/img/shop/hint3.png";
import randomBuffImg from "../../assets/img/shop/randombuff.png";
import timeStopImg from "../../assets/img/shop/timestop.png";

interface RouletteProps {
  balance: number;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  onReward: (rewardId: string) => void;
  showToast: (msg: string) => void;
}

const Roulette: React.FC<RouletteProps> = ({ balance, setBalance, onReward, showToast }) => {
  const [isRolling, setIsRolling] = useState(false);
  const [resultItem, setResultItem] = useState<string | null>(null);

  const rouletteItems = [
    { id: "item-hint1", label: "힌트 1회권", img: hint1Img, weight: 40 },
    { id: "item-hint3", label: "힌트 3회권", img: hint3Img, weight: 25 },
    { id: "item-buff", label: "랜덤 버프 패키지", img: randomBuffImg, weight: 20 },
    { id: "item-timestop", label: "시간 정지권", img: timeStopImg, weight: 15 }
  ];

  const slotCenterAngles = [225, 135, 45, 315];

  const handleSpinRoulette = async () => {
    if (isRolling) return;

    if (balance < 10) {
      showToast("코인이 부족합니다! (필요: 10 HTO)");
      return;
    }

    setIsRolling(true);

    try {
      // 🎰 백엔드 API 호출
      const result = await spinRoulette();

      // 🔍 백엔드에서 받은 결과로 룰렛 아이템 찾기
      const selected = rouletteItems.find(item => item.id === result.rewardId);

      if (!selected) {
        showToast("오류가 발생했습니다.");
        setIsRolling(false);
        return;
      }

      const selectedIndex = rouletteItems.indexOf(selected);
      const wheel = document.getElementById("roulette-wheel") as HTMLElement;

      // 💸 잔액 업데이트 (백엔드에서 받은 값으로)
      setBalance(result.updatedBalance);

      // 🎡 룰렛 애니메이션
      if (wheel) {
        wheel.style.transition = "none";
        wheel.style.transform = "rotate(0deg)";
      }

      setTimeout(() => {
        if (wheel)
          wheel.style.transition = "transform 4s cubic-bezier(0.1, 0.95, 0.37, 1)";
      }, 50);

      const finalAngle = 360 * 6 + slotCenterAngles[selectedIndex];

      setTimeout(() => {
        if (wheel) wheel.style.transform = `rotate(${finalAngle}deg)`;
      }, 100);

      setTimeout(() => {
        setResultItem(selected.label);
        showToast(`${selected.label} 획득!`);
        onReward(selected.id);
        setIsRolling(false);
      }, 4200);
    } catch (err: any) {
      console.error("❌ 룰렛 오류:", err);
      showToast(err?.response?.data?.msg || "룰렛 실행 중 오류가 발생했습니다.");
      setIsRolling(false);
    }
  };

  return (
    <div className="roulette-container">
      <div className="roulette-main-row">
        <div className="roulette-wheel-box">
          <div className="roulette-pointer">▼</div>

          <div className="roulette-wheel" id="roulette-wheel">
            {rouletteItems.map((item, index) => (
              <div
                key={index}
                className="roulette-segment"
                style={{
                  transform: `rotate(${(360 / rouletteItems.length) * index}deg)`
                }}
              >
                <img src={item.img} alt={item.label} className="roulette-item-img" />
              </div>
            ))}
          </div>
        </div>

        <div className="roulette-info">
          <h2 className="roulette-title">🎰 HTO 룰렛</h2>
          <p className="roulette-sub">1회 비용: <strong>10 HTO</strong></p>

          {resultItem && (
            <div className="roulette-result-box">
              🎉 <span>{resultItem}</span> 획득!
            </div>
          )}
        </div>
      </div>

      <button
        className="roulette-button"
        onClick={handleSpinRoulette}
        disabled={isRolling}
      >
        {isRolling ? "돌리는 중..." : "START"}
      </button>
    </div>
  );
};

export default Roulette;