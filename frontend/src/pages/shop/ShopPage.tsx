import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import "../../assets/scss/shop/ShopPage.scss";
import "../../assets/scss/shop/ShopInventory.scss";
import "../../assets/scss/shop/NPCButton.scss";
import "../../assets/scss/shop/NPCHelp.scss";

import Main from "../../components/main/Main";
import Roulette from "../../components/shop/Roulette";
import NPCHelp from "../../components/shop/NPCHelp";
import ShopToast from "../../components/shop/ShopToast";

import {
  getBalance,
  getShopItems,
  buyShopItem,
  getInventory,
  useInventoryItem,
} from "../../api/axiosShop";

type ShopItem = {
  _id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  type: string;
};

type InventoryItem = {
  _id: string;
  item: {
    _id: string;
    name: string;
    description: string;
    price: number;
    icon: string;
    type: string;
  };
  quantity: number;
  acquiredAt: string;
};

const ShopPage: React.FC = () => {
  const { t, i18n } = useTranslation("shop");

  const [balance, setBalance] = useState(0);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [tab, setTab] = useState<"shop" | "inventory" | "roulette">("shop");
  const [isNPCOpen, setIsNPCOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; icon?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // 초기 데이터 로드
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // 병렬로 데이터 로드
      const [balanceData, itemsData, inventoryData] = await Promise.all([
        getBalance(),
        getShopItems(),
        getInventory(),
      ]);

      setBalance(balanceData.balance);
      setShopItems(itemsData);
      setInventory(inventoryData);
    } catch (error: any) {
      console.error('❌ Failed to load initial data:', error);
      showToast(error?.response?.data?.msg || t('errors.loadFailed') || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, icon?: string) => {
    setToast({ msg, icon });
  };

  /* -------------------------------------- */
  /* 🛒 구매 */
  /* -------------------------------------- */
  const handleBuyItem = async (itemId: string) => {
    try {
      const result = await buyShopItem(itemId);
      
      // 잔액 업데이트
      setBalance(result.updatedBalance);
      
      // 인벤토리 새로고침
      const updatedInventory = await getInventory();
      setInventory(updatedInventory);
      
      // 성공 토스트
      const item = shopItems.find(i => i._id === itemId);
      showToast(result.msg, item?.icon);
    } catch (error: any) {
      console.error('❌ Failed to buy item:', error);
      showToast(error?.response?.data?.msg || t('errors.buyFailed') || '구매에 실패했습니다.');
    }
  };

  /* -------------------------------------- */
  /* 🧩 사용 */
  /* -------------------------------------- */
  const handleUseItem = async (invId: string) => {
    try {
      const result = await useInventoryItem(invId);
      
      // 인벤토리 새로고침
      const updatedInventory = await getInventory();
      setInventory(updatedInventory);
      
      showToast(result.msg);
    } catch (error: any) {
      console.error('❌ Failed to use item:', error);
      showToast(error?.response?.data?.msg || t('errors.useFailed') || '아이템 사용에 실패했습니다.');
    }
  };

  /* -------------------------------------- */
  /* 🎰 룰렛 보상 */
  /* -------------------------------------- */
  const handleRouletteReward = async (rewardId: string) => {
    try {
      // 인벤토리 새로고침
      const updatedInventory = await getInventory();
      setInventory(updatedInventory);
      
      // 잔액도 새로고침 (룰렛에서 이미 업데이트했지만 확실하게)
      const balanceData = await getBalance();
      setBalance(balanceData.balance);
    } catch (error: any) {
      console.error('❌ Failed to process roulette reward:', error);
    }
  };

  if (loading) {
    return (
      <Main>
        <div className="shop-layout">
          <div className="shop-panel">
            <div className="shop-loading">
              {t('loading') || '로딩 중...'}
            </div>
          </div>
        </div>
      </Main>
    );
  }

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

          {/* 탭 */}
          <div className="shop-tabs">
            <button 
              className={tab === "shop" ? "active" : ""} 
              onClick={() => setTab("shop")}
            >
              {t("tabs.shop")}
            </button>
            <button 
              className={tab === "inventory" ? "active" : ""} 
              onClick={() => setTab("inventory")}
            >
              {t("tabs.inventory")}
            </button>
            <button 
              className={tab === "roulette" ? "active" : ""} 
              onClick={() => setTab("roulette")}
            >
              {t("tabs.roulette")}
            </button>
          </div>

          {/* SHOP */}
          {tab === "shop" && (
            <div className="shop-grid">
              {shopItems.length === 0 ? (
                <div className="shop-empty">
                  {t('shop.empty') || '판매 중인 아이템이 없습니다.'}
                </div>
              ) : (
                shopItems.map((item) => {
                  const translationKey = `items.${item.name}`;
                  const translatedName = t(`${translationKey}.name`, { defaultValue: item.name });
                  const translatedDesc = t(`${translationKey}.desc`, { defaultValue: item.description });

                  return (
                  <div className="shop-item-card" key={item._id}>
                    <img
                      src={`http://localhost:5000${item.icon || (item as any).imageUrl || ''}`}
                      className="shop-item-card__icon"
                      alt={translatedName}
                      onError={(e) => {
                        // 이미지 로드 실패 시 기본 이미지
                        e.currentTarget.src = '/img/default-item.png';
                      }}
                    />

                    <div className="shop-item-card__header">
                      <h3>{translatedName}</h3>
                      <span>{item.price} HTO</span>
                    </div>

                    <p className="shop-item-card__desc">
                      {translatedDesc}
                    </p>

                    <button
                      className="shop-item-card__btn"
                      onClick={() => handleBuyItem(item._id)}
                      disabled={balance < item.price}
                    >
                      {balance < item.price
                        ? (t("buttons.notEnough") || "코인 부족")
                        : (t("buttons.buy") || "구매")
                      }
                    </button>
                  </div>
                  );
                })
              )}
            </div>
          )}

          {/* INVENTORY */}
          {tab === "inventory" && (
            <div className="shop-inventory-wrapper">
              <div className="shop-inventory-scroll-area">
                {inventory.length === 0 ? (
                  <div className="shop-inventory-empty">
                    {t("inventory.empty")}
                  </div>
                ) : (
                  <div className="shop-inventory-list">
                    {inventory.map((inv) => {
                      const translationKey = `items.${inv.item.name}`;
                      const translatedName = t(`${translationKey}.name`, { defaultValue: inv.item.name });
                      const translatedDesc = t(`${translationKey}.desc`, { defaultValue: inv.item.description });

                      return (
                      <div className="shop-inventory-card" key={inv._id}>
                        <img
                          src={`http://localhost:5000${inv.item.icon || (inv.item as any).imageUrl || ''}`}
                          className="shop-inventory-card__icon"
                          alt={translatedName}
                          onError={(e) => {
                            e.currentTarget.src = '/img/default-item.png';
                          }}
                        />

                        <div className="shop-inventory-card__body">
                          <h3 className="shop-inventory-card__title">
                            {translatedName}
                          </h3>
                          <p className="shop-inventory-card__count">x{inv.quantity}</p>
                          <p className="shop-inventory-card__desc">
                            {translatedDesc}
                          </p>
                        </div>

                        <button
                          className="shop-inventory-card__btn"
                          onClick={() => handleUseItem(inv._id)}
                        >
                          {t("buttons.use")}
                        </button>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
      <button 
        className="npc-help-button" 
        onClick={() => setIsNPCOpen((prev) => !prev)}
      >
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