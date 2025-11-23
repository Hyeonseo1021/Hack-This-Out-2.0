import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "../../assets/scss/Shop/Roulette.scss";

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

/* 🔥 명확한 타입 정의 */
interface RouletteItem {
  id: "item-hint1" | "item-hint3" | "item-buff" | "item-timestop";
  img: string;
  weight: number;
}

const Roulette: React.FC<RouletteProps> = ({ balance, setBalance, onReward, showToast }) => {
  const { t } = useTranslation("shop");

  const rouletteItems: RouletteItem[] = [
    { id: "item-hint1", img: hint1Img, weight: 40 },
    { id: "item-hint3", img: hint3Img, weight: 25 },
    { id: "item-buff", img: randomBuffImg, weight: 20 },
    { id: "item-timestop", img: timeStopImg, weight: 15 }
  ];

  const slotCenterAngles = [225, 135, 45, 315];

  const [isRolling, setIsRolling] = useState(false);
  const [resultItemId, setResultItemId] = useState<RouletteItem["id"] | null>(null);

  const spinRoulette = () => {
    if (isRolling) return;

    if (balance < 10) {
      showToast(t("roulette.noCoin"));
      return;
    }

    setBalance(prev => prev - 10);
    setIsRolling(true);

    const totalWeight = rouletteItems.reduce((sum, item) => sum + item.weight, 0);
    const rand = Math.random() * totalWeight;

    let acc = 0;
    let selected: RouletteItem = rouletteItems[0];

    for (const item of rouletteItems) {
      acc += item.weight;
      if (rand <= acc) {
        selected = item;
        break;
      }
    }

    const selectedIndex = rouletteItems.indexOf(selected);
    const wheel = document.getElementById("roulette-wheel") as HTMLElement;

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
      setResultItemId(selected.id);

      const name = t(`items.${selected.id}.name`);
      showToast(`${name} ${t("roulette.got")}`);

      onReward(selected.id);
      setIsRolling(false);
    }, 4200);
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
                style={{ transform: `rotate(${(360 / rouletteItems.length) * index}deg)` }}
              >
                <img src={item.img} alt="" className="roulette-item-img" />
              </div>
            ))}
          </div>
        </div>

        <div className="roulette-info">
          <h2 className="roulette-title">{t("roulette.title")}</h2>
          <p className="roulette-sub">
            {t("roulette.cost")} <strong>10 HTO</strong>
          </p>

          {resultItemId && (
            <div className="roulette-result-box">
              🎉 {t(`items.${resultItemId}.name`)} {t("roulette.got")}
            </div>
          )}
        </div>
      </div>

      {/* ⭕ START만 고정, 나머지는 i18n 유지 */}
      <button className="roulette-button" onClick={spinRoulette} disabled={isRolling}>
        {isRolling ? t("roulette.rolling") : "START"}
      </button>
    </div>
  );
};

export default Roulette;
