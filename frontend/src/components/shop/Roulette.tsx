import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../../assets/scss/Shop/Roulette.scss";
import { spinRoulette, getRouletteItems } from "../../api/axiosShop";

interface RouletteProps {
  balance: number;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  onReward: (rewardId: string) => void;
  showToast: (msg: string) => void;
}

/* 🔥 동적 룰렛 아이템 타입 */
interface RouletteItem {
  id: string;
  name: string;
  icon: string;
  weight: number;
}

const Roulette: React.FC<RouletteProps> = ({ balance, setBalance, onReward, showToast }) => {
  const { t } = useTranslation("shop");

  const [rouletteItems, setRouletteItems] = useState<RouletteItem[]>([]);
  const [slotCenterAngles, setSlotCenterAngles] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [resultItemId, setResultItemId] = useState<string | null>(null);

  // 🎰 룰렛 아이템 로드
  useEffect(() => {
    const loadRouletteItems = async () => {
      try {
        const items = await getRouletteItems();
        setRouletteItems(items);

        // 아이템 개수에 맞춰 각도 계산
        const angleStep = 360 / items.length;
        const angles = items.map((_, index) => 270 - angleStep * index);
        setSlotCenterAngles(angles);

        setIsLoading(false);
      } catch (err: any) {
        console.error("❌ 룰렛 아이템 로드 실패:", err);
        showToast(err?.response?.data?.msg || "룰렛 아이템을 불러오는데 실패했습니다.");
        setIsLoading(false);
      }
    };

    loadRouletteItems();
  }, [showToast]);

  // 🎰 룰렛 돌리기
  const handleSpinRoulette = async () => {
    if (isRolling || isLoading) return;

    if (balance < 10) {
      showToast(t("roulette.noCoin"));
      return;
    }

    setBalance(prev => prev - 10);
    setIsRolling(true);

    try {
      // 🎰 백엔드 API 호출
      const result = await spinRoulette();

      // 🔍 백엔드에서 받은 결과로 룰렛 아이템 찾기
      const selectedIndex = rouletteItems.findIndex(item => item.id === result.rewardId);

      if (selectedIndex === -1) {
        showToast("오류가 발생했습니다.");
        setIsRolling(false);
        setBalance(prev => prev + 10); // 실패 시 코인 환불
        return;
      }

      const selected = rouletteItems[selectedIndex];
      const wheel = document.getElementById("roulette-wheel") as HTMLElement;

      // 💸 잔액 업데이트 (백엔드에서 받은 값으로)
      setBalance(result.updatedBalance);

      // 🎡 룰렛 애니메이션
      if (wheel) {
        wheel.style.transition = "none";
        wheel.style.transform = "rotate(0deg)";
      }

      setTimeout(() => {
        if (wheel) {
          wheel.style.transition = "transform 4s cubic-bezier(0.1, 0.95, 0.37, 1)";
        }
      }, 50);

      const finalAngle = 360 * 6 + slotCenterAngles[selectedIndex];

      setTimeout(() => {
        if (wheel) {
          wheel.style.transform = `rotate(${finalAngle}deg)`;
        }
      }, 100);

      setTimeout(() => {
        setResultItemId(selected.id);

        // 번역된 이름 사용 (또는 서버에서 받은 이름)
        const translatedName = t(`items.${selected.name}.name`, { defaultValue: result.rewardName });
        showToast(`${translatedName} ${t("roulette.got")}`);

        onReward(selected.id);
        setIsRolling(false);
      }, 4200);

    } catch (err: any) {
      console.error("❌ 룰렛 오류:", err);
      showToast(err?.response?.data?.msg || "룰렛 실행 중 오류가 발생했습니다.");
      setIsRolling(false);
      setBalance(prev => prev + 10); // 오류 시 코인 환불
    }
  };

  if (isLoading) {
    return (
      <div className="roulette-container">
        <div className="roulette-loading">Loading roulette items...</div>
      </div>
    );
  }

  if (rouletteItems.length === 0) {
    return (
      <div className="roulette-container">
        <div className="roulette-error">룰렛 아이템이 설정되지 않았습니다.</div>
      </div>
    );
  }

  return (
    <div className="roulette-container">
      <div className="roulette-main-row">
        <div className="roulette-wheel-box">
          <div className="roulette-pointer">▼</div>

          <div className="roulette-wheel" id="roulette-wheel">
            {rouletteItems.map((item, index) => (
              <div
                key={item.id}
                className="roulette-segment"
                style={{ transform: `rotate(${(360 / rouletteItems.length) * index}deg)` }}
              >
                <img
                  src={`http://localhost:5000${item.icon}`}
                  alt={item.name}
                  className="roulette-item-img"
                  onError={(e) => {
                    e.currentTarget.src = '/img/default-item.png';
                  }}
                />
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
              🎉 {t(`items.${rouletteItems.find(i => i.id === resultItemId)?.name}.name`, {
                defaultValue: rouletteItems.find(i => i.id === resultItemId)?.name
              })} {t("roulette.got")}
            </div>
          )}
        </div>
      </div>

      <button
        className="roulette-button"
        onClick={handleSpinRoulette}
        disabled={isRolling || isLoading}
      >
        {isRolling ? t("roulette.rolling") : "START"}
      </button>
    </div>
  );
};

export default Roulette;