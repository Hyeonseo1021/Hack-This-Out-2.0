// src/pages/shop/ShopPage.tsx
import React, { useEffect, useState } from 'react';
import { getShopItems, buyShopItem, getInventory } from '../../api/axiosShop';
import { getUserDetail } from '../../api/axiosUser';
import { ShopItem } from '../../types/ShopItem';
import ShopItemCard from '../../components/shop/ShopItemCard';
import '../../assets/scss/Shop/ShopPage.scss';
import Main from '../../components/main/Main';
import { toast } from 'react-toastify';

type InventoryEntry = {
  _id: string;
  item: ShopItem | null;
  isUsed: boolean;
  acquiredAt: string;
};

const ShopPage: React.FC = () => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [invLoading, setInvLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    setInvLoading(true);
    try {
      const [itemsData, me, invData] = await Promise.all([
        getShopItems(),
        getUserDetail(),
        getInventory(), // GET /shop/inventory
      ]);
      setItems(Array.isArray(itemsData) ? itemsData : []);
      const coin = typeof me?.user?.htoCoin === 'number' ? me.user.htoCoin : 0;
      setBalance(coin);
      setInventory(Array.isArray(invData) ? invData : []);
    } catch (e) {
      alert('상점 아이템/잔액/인벤토리 불러오기 실패');
    } finally {
      setLoading(false);
      setInvLoading(false);
    }
  };


  useEffect(() => {
    fetchAll();
  }, []);

  const handleBuyItem = async (itemId: string) => {
    if (buyingId) return; // 중복 클릭 방지
    try {
      setBuyingId(itemId);
      const msg = await buyShopItem(itemId);
      toast.success(msg || '아이템 구매 성공!');
      await fetchAll(); // 구매 후 코인/인벤토리 재조회
    } catch (err: any) {
      const msg = err?.response?.data?.msg || err?.message || '구매 실패';
      if (msg === 'lacked Coin.' || msg.includes('코인')) {
        alert('코인이 부족합니다.');
      } else {
        alert(msg);
      }
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <Main>
      <div className="shop-layout--blueprint">
        
        {/* ─ Left: Shop Panel ─ */}
        <section className="panel--blueprint">
          <div className="panel__header">
            <h1 className="panel__title">SHOP TERMINAL</h1>
          </div>
          <div className="panel__content">
            <div className="shop-balance">
              <span> 보유 자산 </span>
              <strong>{balance === null ? '...' : `${balance} HTO`}</strong>
            </div>
            {loading && <div className="loader">데이터베이스 접속 중...</div>}
            {!loading && items.length === 0 && (
              <div className="empty-state">판매 가능한 아이템이 없습니다.</div>
            )}
            {!loading && items.length > 0 && (
              <div className="shop-grid">
                {items.map((item) => (
                  <div key={item._id} className="shop-item">
                    <div className="shop-item__header">
                      <h3>{item.name}</h3>
                      <span>{item.price} HTO</span>
                    </div>
                    <p className="shop-item__desc">{item.description}</p>
                    <button
                      className="shop-item__btn"
                      onClick={() => handleBuyItem(item._id)}
                      disabled={buyingId === item._id}
                    >
                      {buyingId === item._id ? '처리 중...' : '아이템 획득'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        
        {/* ─ Right: Inventory Panel ─ */}
        <aside className="panel--blueprint">
          <div className="panel__header">
            <h2 className="panel__title">INVENTORY LOG</h2>
          </div>
          <div className="panel__content">
            {invLoading ? (
              <div className="loader">인벤토리 스캔 중...</div>
            ) : inventory.length === 0 ? (
              <div className="empty-state">보유한 아이템이 없습니다.</div>
            ) : (
              <ul className="inventory-list">
                {inventory.map((e) => {
                  const name = e.item?.name ?? '[알 수 없는 아이템]';
                  return (
                    <li key={e._id} className="inventory-item">
                      <span className="inventory-item__name">{name}</span>
                      <div className="inventory-item__meta">
                        {e.isUsed && <span className="badge--used">사용됨</span>}
                        <span className="inventory-item__date">
                          {new Date(e.acquiredAt).toLocaleDateString()}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </Main>
  );
};

export default ShopPage;