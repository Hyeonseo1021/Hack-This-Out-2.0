import React, { useState, useEffect } from "react";
import "../../assets/scss/shop/ShopPage.scss";
import "../../assets/scss/shop/NPCButton.scss";
import "../../assets/scss/shop/NPCHelp.scss";

import Main from "../../components/main/Main";
import Roulette from "../../components/shop/Roulette";
import NPCHelp from "../../components/shop/NPCHelp";
import ShopToast from "../../components/shop/ShopToast";

import hint1Img from "../../assets/img/shop/hint1.png";
import hint3Img from "../../assets/img/shop/hint3.png";
import randomBuffImg from "../../assets/img/shop/randombuff.png";
import timeStopImg from "../../assets/img/shop/timestop.png";

type InventoryItem = {
  itemId: string;
  name: string;
  icon: string;
  description: string;
  count: number;
};

export const LOCAL_ITEMS = [
  { _id: "item-hint1", name: "힌트 1회권", description: "문제 힌트를 1번 열람할 수 있습니다.", price: 5, icon: hint1Img },
  { _id: "item-hint3", name: "힌트 3회권", description: "문제 힌트를 3번 열람할 수 있습니다.", price: 12, icon: hint3Img },
  { _id: "item-buff", name: "랜덤 버프 패키지", description: "게임에서 버프 효과를 무작위로 획득합니다.", price: 15, icon: randomBuffImg },
  { _id: "item-timestop", name: "시간 정지권", description: "아레나 타이머를 30초간 멈춥니다.", price: 25, icon: timeStopImg },
];

const ShopPage: React.FC = () => {
  const [balance, setBalance] = useState(150);
  const [tab, setTab] = useState<"shop" | "inventory" | "roulette">("shop");
  const [isNPCOpen, setIsNPCOpen] = useState(false);

  const [toast, setToast] = useState<{ msg: string; icon?: string } | null>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("HTO_INVENTORY");
    if (saved) setInventory(JSON.parse(saved));
  }, []);

  const saveInventory = (list: InventoryItem[]) => {
    localStorage.setItem("HTO_INVENTORY", JSON.stringify(list));
    setInventory(list);
  };

  const showToast = (msg: string, icon?: string) => {
    setToast({ msg, icon });
  };

  const handleBuyItem = (id: string) => {
    const item = LOCAL_ITEMS.find((x) => x._id === id);
    if (!item) return;

    if (balance < item.price) {
      showToast(`코인이 부족합니다! (필요: ${item.price} HTO)`);
      return;
    }

    setBalance((prev) => prev - item.price);

    const exists = inventory.find((x) => x.itemId === id);

    let newInventory;
    if (exists) {
      newInventory = inventory.map((x) =>
        x.itemId === id ? { ...x, count: x.count + 1 } : x
      );
    } else {
      newInventory = [
        ...inventory,
        {
          itemId: id,
          name: item.name,
          icon: item.icon,
          description: item.description,
          count: 1,
        },
      ];
    }

    saveInventory(newInventory);
    showToast(`${item.name}이(가) 인벤토리에 추가되었습니다.`, item.icon);
  };

  const handleUseItem = (itemId: string) => {
    const target = inventory.find((x) => x.itemId === itemId);
    if (!target) return;

    showToast(`${target.name}을 사용했습니다!`, target.icon);

    let newInventory;
    if (target.count > 1) {
      newInventory = inventory.map((x) =>
        x.itemId === itemId ? { ...x, count: x.count - 1 } : x
      );
    } else {
      newInventory = inventory.filter((x) => x.itemId !== itemId);
    }

    saveInventory(newInventory);
  };

  const handleRouletteReward = (rewardId: string) => {
    const item = LOCAL_ITEMS.find((x) => x._id === rewardId);
    if (!item) return;

    const exists = inventory.find((x) => x.itemId === rewardId);

    let newInventory;
    if (exists) {
      newInventory = inventory.map((x) =>
        x.itemId === rewardId ? { ...x, count: x.count + 1 } : x
      );
    } else {
      newInventory = [
        ...inventory,
        {
          itemId: rewardId,
          name: item.name,
          icon: item.icon,
          description: item.description,
          count: 1,
        },
      ];
    }

    saveInventory(newInventory);
    showToast(`${item.name}을 획득했습니다!`, item.icon);
  };

  return (
    <Main>
      <div className="shop-layout">
        <div className="shop-panel">
          <h1 className="shop-title">SHOP TERMINAL</h1>

          <p className="shop-balance">
            CURRENT BALANCE: <strong>{balance} HTO</strong>
          </p>

          <div className="shop-tabs">
            <button className={tab === "shop" ? "active" : ""} onClick={() => setTab("shop")}>상점</button>
            <button className={tab === "inventory" ? "active" : ""} onClick={() => setTab("inventory")}>인벤토리</button>
            <button className={tab === "roulette" ? "active" : ""} onClick={() => setTab("roulette")}>룰렛</button>
          </div>

          {/* SHOP */}
          {tab === "shop" && (
            <div className="shop-grid">
              {LOCAL_ITEMS.map((item) => (
                <div className="shop-item-card" key={item._id}>
                  <img src={item.icon} className="shop-item-card__icon" />

                  <div className="shop-item-card__header">
                    <h3>{item.name}</h3>
                    <span>{item.price} HTO</span>
                  </div>

                  <p className="shop-item-card__desc">{item.description}</p>

                  <button className="shop-item-card__btn" onClick={() => handleBuyItem(item._id)}>
                    구매
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* INVENTORY */}
          {tab === "inventory" && (
            <div className="inventory-grid">
              {inventory.length === 0 ? (
                <div className="placeholder">📦 보유한 아이템이 없습니다.</div>
              ) : (
                inventory.map((item) => (
                  <div className="inventory-item-card" key={item.itemId}>
                    <img src={item.icon} className="inventory-item-card__icon" />

                    <div className="inventory-item-card__header">
                      <h3>{item.name}</h3>
                      <span className="inventory-count">x{item.count}</span>
                    </div>

                    <p className="inventory-item-card__desc">{item.description}</p>

                    <button
                      className="inventory-item-card__btn"
                      onClick={() => handleUseItem(item.itemId)}
                    >
                      사용하기
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ROULETTE */}
          {tab === "roulette" && (
            <Roulette
              balance={balance}
              setBalance={setBalance}
              onReward={handleRouletteReward}
              showToast={(msg) => showToast(msg)}
            />
          )}
        </div>
      </div>

      {/* NPC HELP */}
      <NPCHelp open={isNPCOpen} onClose={() => setIsNPCOpen(false)} />

      {/* NPC BUTTON */}
      <button className="npc-help-button" onClick={() => setIsNPCOpen((prev) => !prev)}>
        ?
      </button>

      {/* TOAST */}
      {toast && (
        <ShopToast
          message={toast.msg}
          icon={toast.icon}
          onClose={() => setToast(null)}
        />
      )}
    </Main>
  );
};

export default ShopPage;