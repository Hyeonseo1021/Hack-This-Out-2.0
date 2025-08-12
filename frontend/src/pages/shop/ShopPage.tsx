import React, { useEffect, useState } from 'react';
import { getShopItems, buyShopItem } from '../../api/axiosShop';
import { ShopItem } from '../../types/ShopItem'; // 대소문자 정확하게
import ShopItemCard from '../../components/shop/ShopItemCard';
import '../../assets/scss/Shop/ShopPage.scss';
import Main from '../../components/main/Main';
import { toast } from 'react-toastify';

const ShopPage: React.FC = () => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 아이템 불러오기
  const fetchItems = async () => {
    try {
      const data = await getShopItems(); // ✅ ShopItem[] 직접 반환
      setItems(data); // ✅ 바로 배열로 할당
    } catch (err) {
      toast.error('상점 아이템 불러오기 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // 아이템 구매 처리
  const handleBuyItem = async (itemId: string) => {
    try {
      await buyShopItem(itemId);
      toast.success('아이템 구매 성공!');
    } catch (err: any) {
      toast.error(err?.response?.data?.msg || '구매 실패');
    }
  };

  return (
    <Main title="상점" description="토큰을 사용하여 아이템을 구매하세요.">
      <div className="shop-page">
        <h1 className="shop-title">🎁 상점</h1>
        {loading ? (
          <p>아이템을 불러오는 중...</p>
        ) : (
          <div className="shop-grid">
            {items.map((item) => (
              <ShopItemCard key={item._id} item={item} onBuy={handleBuyItem} />
            ))}
          </div>
        )}
      </div>
    </Main>
  );
};

export default ShopPage;
