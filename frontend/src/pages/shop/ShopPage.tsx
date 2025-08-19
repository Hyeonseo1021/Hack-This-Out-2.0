// src/pages/shop/ShopPage.tsx
import React, { useEffect, useState } from 'react';
import { getShopItems, buyShopItem } from '../../api/axiosShop';
import { ShopItem } from '../../types/ShopItem';
import ShopItemCard from '../../components/shop/ShopItemCard';
import '../../assets/scss/Shop/ShopPage.scss';
import Main from '../../components/main/Main';
import { toast } from 'react-toastify';

const ShopPage: React.FC = () => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const data = await getShopItems(); // 서버가 배열 그대로 반환
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error('상점 아이템 불러오기 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleBuyItem = async (itemId: string) => {
    if (buyingId) return; // 중복 클릭 방지
    try {
      setBuyingId(itemId);
      const msg = await buyShopItem(itemId);
      toast.success(msg || '아이템 구매 성공!');
      // (선택) 코인/인벤토리 갱신이 필요하면 여기서 전역 상태/쿼리 무효화
    } catch (err: any) {
      const msg = err?.response?.data?.msg || err?.message || '구매 실패';
      toast.error(msg);
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <Main title="Shop">
      <div className="shop-page">
        <h1 className="shop-title">🎁 상점</h1>

        {loading && (
          <div className="shop-skeleton">로딩 중...</div>
        )}

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
      </div>
    </Main>
  );
};

export default ShopPage;
