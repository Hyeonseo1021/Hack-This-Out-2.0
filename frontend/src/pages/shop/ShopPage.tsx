import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

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
  { _id: "item-hint1", price: 5, icon: hint1Img },
  { _id: "item-hint3", price: 12, icon: hint3Img },
  { _id: "item-buff", price: 15, icon: randomBuffImg },
  { _id: "item-timestop", price: 25, icon: timeStopImg },
];

const ShopPage: React.FC = () => {
  const { t, i18n } = useTranslation("shop");

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
    const base = LOCAL_ITEMS.find((x) => x._id === id);
    if (!base) return;

    const itemName = t(`items.${id}.name`);
    const itemDesc = t(`items.${id}.desc`);
    const price = base.price;

    if (balance < price) {
      showToast(t("toast.noCoin", { price }));
      return;
    }

    setBalance((prev) => prev - price);

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
          name: itemName,
          icon: base.icon,
          description: itemDesc,
          count: 1,
        },
      ];
    }

    saveInventory(newInventory);
    showToast(t("toast.added", { name: itemName }), base.icon);
  };

  const handleUseItem = (itemId: string) => {
    const target = inventory.find((x) => x.itemId === itemId);
    if (!target) return;

    showToast(t("toast.used", { name: target.name }), target.icon);

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
    const base = LOCAL_ITEMS.find((x) => x._id === rewardId);
    if (!base) return;

    const itemName = t(`items.${rewardId}.name`);
    const itemDesc = t(`items.${rewardId}.desc`);

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
          name: itemName,
          icon: base.icon,
          description: itemDesc,
          count: 1,
        },
      ];
    }

    saveInventory(newInventory);
    showToast(t("toast.reward", { name: itemName }), base.icon);
  };

  return (
    <Main>
      <div className="shop-layout">

        {/* 🔵 언어 전환 버튼 */}
        <div className="shop-lang-toggle">
          <button
            className={i18n.language === "ko" ? "active" : ""}
            onClick={() => i18n.changeLanguage("ko")}
          >
            KR
          </button>
          <span>|</span>
          <button
            className={i18n.language === "en" ? "active" : ""}
            onClick={() => i18n.changeLanguage("en")}
          >
            EN
          </button>
        </div>

        <div className="shop-panel">
          <h1 className="shop-title">{t("title")}</h1>

          <p className="shop-balance">
            {t("balance")} <strong>{balance} HTO</strong>
          </p>

          <div className="shop-tabs">
            <button className={tab === "shop" ? "active" : ""} onClick={() => setTab("shop")}>
              {t("tabs.shop")}
            </button>
            <button className={tab === "inventory" ? "active" : ""} onClick={() => setTab("inventory")}>
              {t("tabs.inventory")}
            </button>
            <button className={tab === "roulette" ? "active" : ""} onClick={() => setTab("roulette")}>
              {t("tabs.roulette")}
            </button>
          </div>

          {/* SHOP */}
          {tab === "shop" && (
            <div className="shop-grid">
              {LOCAL_ITEMS.map((item) => (
                <div className="shop-item-card" key={item._id}>
                  <img src={item.icon} className="shop-item-card__icon" />

                  <div className="shop-item-card__header">
                    <h3>{t(`items.${item._id}.name`)}</h3>
                    <span>{item.price} HTO</span>
                  </div>

                  <p className="shop-item-card__desc">{t(`items.${item._id}.desc`)}</p>

                  <button className="shop-item-card__btn" onClick={() => handleBuyItem(item._id)}>
                    {t("buttons.buy")}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* INVENTORY */}
          {tab === "inventory" && (
            <div className="inventory-grid ctype-list">
              {inventory.length === 0 ? (
                <div className="placeholder">{t("inventory.empty")}</div>
              ) : (
                inventory.map((item) => (
                  <div className="inventory-item-card ctype-card" key={item.itemId}>
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
                      {t("buttons.use")}
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
      <button className="npc-help-button" onClick={() => setIsNPCOpen((prev) => !prev)}>?</button>

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
