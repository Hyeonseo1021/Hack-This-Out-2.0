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
  name: {
    ko: string;
    en: string;
  } | string; // Backward compatibility
  icon: string;
  weight: number;
}

const Roulette: React.FC<RouletteProps> = ({ balance, setBalance, onReward, showToast }) => {
  const { t, i18n } = useTranslation("shop");

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
        const angles = items.map((_, index) => {
          // 각 아이템의 중심 각도 (12시 방향이 270도)
          return 270 - (angleStep * index) - (angleStep / 2);
        });
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

    if (balance < 5) {
      showToast(t("roulette.noCoin"));
      return;
    }

    setBalance(prev => prev - 5);
    setIsRolling(true);

    try {
      // 🎰 백엔드 API 호출
      const result = await spinRoulette();

      // 🔍 백엔드에서 받은 결과로 룰렛 아이템 찾기
      const selectedIndex = rouletteItems.findIndex(item => item.id === result.rewardId);

      if (selectedIndex === -1) {
        showToast("오류가 발생했습니다.");
        setIsRolling(false);
        setBalance(prev => prev + 5); // 실패 시 코인 환불
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

        // 다국어 지원: name이 객체인 경우 현재 언어로 선택
        const lang = i18n.language as 'ko' | 'en';
        const itemName = typeof selected.name === 'object'
          ? selected.name[lang] || selected.name.ko || selected.name.en
          : selected.name;

        showToast(`${itemName} ${t("roulette.got")}`);

        onReward(selected.id);
        setIsRolling(false);
      }, 4200);

    } catch (err: any) {
      console.error("❌ 룰렛 오류:", err);
      showToast(err?.response?.data?.msg || "룰렛 실행 중 오류가 발생했습니다.");
      setIsRolling(false);
      setBalance(prev => prev + 5); // 오류 시 코인 환불
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
            {rouletteItems.map((item, index) => {
              // 다국어 지원: name이 객체인 경우 현재 언어로 선택
              const lang = i18n.language as 'ko' | 'en';
              const itemName = typeof item.name === 'object'
                ? item.name[lang] || item.name.ko || item.name.en
                : item.name;

              return (
                <div
                  key={item.id}
                  className="roulette-segment"
                  style={{ transform: `rotate(${(360 / rouletteItems.length) * index}deg)` }}
                >
                  <img
                    src={`http://localhost:5000${item.icon}`}
                    alt={itemName}
                    className="roulette-item-img"
                    onError={(e) => {
                      e.currentTarget.src = '/img/default-item.png';
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="roulette-info">
          <h2 className="roulette-title">{t("roulette.title")}</h2>
          <p className="roulette-sub">
            {t("roulette.cost")} <strong>5 HTO</strong>
          </p>

          {resultItemId && (() => {
            const resultItem = rouletteItems.find(i => i.id === resultItemId);
            if (!resultItem) return null;

            // 다국어 지원: name이 객체인 경우 현재 언어로 선택
            const lang = i18n.language as 'ko' | 'en';
            const itemName = typeof resultItem.name === 'object'
              ? resultItem.name[lang] || resultItem.name.ko || resultItem.name.en
              : resultItem.name;

            return (
              <div className="roulette-result-box">
                🎉 {itemName} {t("roulette.got")}
              </div>
            );
          })()}
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