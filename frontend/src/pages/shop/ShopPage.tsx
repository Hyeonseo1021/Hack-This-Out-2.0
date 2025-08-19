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
      <div className="shop-layout">
        {/* ─ Left: Shop ─ */}
        <section className="shop-page">
          <h1 className="shop-title">Shop</h1>

          {/* 잔여 코인 표시 */}
          <div className="shop-balance">
            <span style={{ opacity: 0.85 }}>내 보유 코인</span>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
              {balance === null ? '…' : `${balance} HTO`}
            </strong>
          </div>

          {loading && <div className="shop-skeleton">로딩 중...</div>}

          {!loading && items.length === 0 && (
            <div className="shop-empty">지금 진열된 아이템이 없어요.</div>
          )}

          {!loading && items.length > 0 && (
            <div className="shop-grid">
              {items.map((item) => (
                <ShopItemCard
                  key={item._id}
                  item={item}
                  onBuy={() => handleBuyItem(item._id)}
                  disabled={buyingId === item._id}
                />
              ))}
            </div>
          )}
        </section>
        {/* ─ Right: Inventory ─ */}
        <aside className="inventory-panel">
          <div className="inventory-panel__inner">
            <h2 className="inventory-title">내 인벤토리</h2>

            {invLoading ? (
              <div className="inventory-skeleton">불러오는 중…</div>
            ) : inventory.length === 0 ? (
              <div className="inventory-empty">보유한 아이템이 없습니다.</div>
            ) : (
              <ul className="inventory-list">
                {inventory.map((e) => {
                  const name = e.item?.name ?? '(삭제된 아이템)';
                  const desc = e.item?.description ?? '';
                  return (
                    <li key={e._id} className="inventory-item">
                      <div className="inventory-item__left">
                        <div className="inventory-item__name">{name}</div>
                        {!!desc && <div className="inventory-item__desc">{desc}</div>}
                      </div>
                      <div className="inventory-item__right">
                        <div className="inventory-item__date">
                          {new Date(e.acquiredAt).toLocaleDateString()}
                        </div>
                        {e.isUsed && (
                          <span className="inventory-item__badge">사용됨</span>
                        )}
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