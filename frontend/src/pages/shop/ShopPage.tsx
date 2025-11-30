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
} from "../../api/axiosShop";

// API URL에서 base URL 추출 (예: http://localhost:5000/api -> http://localhost:5000)
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

type ShopItem = {
  _id: string;
  name: string | { ko: string; en: string };
  description: string | { ko: string; en: string };
  price: number;
  icon: string;
  type: string;
};

type InventoryItem = {
  _id: string;
  item: {
    _id: string;
    name: string | { ko: string; en: string };
    description: string | { ko: string; en: string };
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

      // 성공 토스트 (다국어 지원)
      const item = shopItems.find(i => i._id === itemId);
      const lang = i18n.language as 'ko' | 'en';

      // 획득한 아이템 이름 추출 (랜덤 버프의 경우 result.acquiredItem 사용)
      const acquiredItemName = result.acquiredItem?.name
        ? (typeof result.acquiredItem.name === 'object'
            ? (result.acquiredItem.name as any)[lang] || (result.acquiredItem.name as any).ko
            : result.acquiredItem.name)
        : (item?.name
            ? (typeof item.name === 'object'
                ? (item.name as any)[lang] || (item.name as any).ko
                : item.name)
            : '');

      // 번역된 메시지 사용
      const successMsg = t('messages.acquired', { itemName: acquiredItemName });
      showToast(successMsg, item?.icon);
    } catch (error: any) {
      console.error('❌ Failed to buy item:', error);
      // 에러 메시지도 다국어 처리
      const errorKey = error?.response?.data?.errorKey;
      const errorMsg = errorKey ? t(`errors.${errorKey}`) : t('errors.buyFailed');
      showToast(errorMsg);
    }
  };

  /* -------------------------------------- */
  /* 🎰 룰렛 보상 */
  /* -------------------------------------- */
  const handleRouletteReward = async (_rewardId: string) => {
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
                  // 다국어 지원: name과 description이 객체인 경우 현재 언어로 선택
                  const lang = i18n.language as 'ko' | 'en';
                  const itemName = typeof item.name === 'object' ? (item.name as any)[lang] || (item.name as any).ko || (item.name as any).en : item.name;
                  const itemDesc = typeof item.description === 'object' ? (item.description as any)[lang] || (item.description as any).ko || (item.description as any).en : item.description;

                  return (
                  <div className="shop-item-card" key={item._id}>
                    <img
                      src={`${API_BASE_URL}${item.icon || (item as any).imageUrl || ''}`}
                      className="shop-item-card__icon"
                      alt={itemName}
                      onError={(e) => {
                        // 이미지 로드 실패 시 기본 이미지
                        e.currentTarget.src = '/img/default-item.png';
                      }}
                    />

                    <div className="shop-item-card__header">
                      <h3>{itemName}</h3>
                      <span>{item.price} HTO</span>
                    </div>

                    <p className="shop-item-card__desc">
                      {itemDesc}
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
                      // 다국어 지원: name과 description이 객체인 경우 현재 언어로 선택
                      const lang = i18n.language as 'ko' | 'en';
                      const itemName = typeof inv.item.name === 'object' ? (inv.item.name as any)[lang] || (inv.item.name as any).ko || (inv.item.name as any).en : inv.item.name;
                      const itemDesc = typeof inv.item.description === 'object' ? (inv.item.description as any)[lang] || (inv.item.description as any).ko || (inv.item.description as any).en : inv.item.description;

                      return (
                      <div className="shop-inventory-card" key={inv._id}>
                        <img
                          src={`${API_BASE_URL}${inv.item.icon || (inv.item as any).imageUrl || ''}`}
                          className="shop-inventory-card__icon"
                          alt={itemName}
                          onError={(e) => {
                            e.currentTarget.src = '/img/default-item.png';
                          }}
                        />

                        <div className="shop-inventory-card__body">
                          <h3 className="shop-inventory-card__title">
                            {itemName}
                          </h3>
                          <p className="shop-inventory-card__count">x{inv.quantity}</p>
                          <p className="shop-inventory-card__desc">
                            {itemDesc}
                          </p>
                          <p className="shop-inventory-card__note" style={{
                            fontSize: '0.85rem',
                            color: '#94a3b8',
                            marginTop: '0.5rem',
                            fontStyle: 'italic'
                          }}>
                            💡 {t("inventory.useInArena", { defaultValue: "아이템은 Arena 플레이 중에 사용할 수 있습니다" })}
                          </p>
                        </div>
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