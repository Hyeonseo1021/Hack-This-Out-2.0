// src/pages/shop/ShopPage.tsx
import React, { useEffect, useState } from 'react';
import { getShopItems, buyShopItem, getInventory } from '../../api/axiosShop';
import { getUserDetail } from '../../api/axiosUser';
import { ShopItem } from '../../types/ShopItem';
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
          <div
            className="panel__header"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
          >
            <h1 className="panel__title">SHOP TERMINAL</h1>

            {/* 정렬 UI (현재 구조 유지 / 사이버 툴바 스타일 적용) */}
            <div className="cy-toolbar">
              <label
                htmlFor="shop-sort"
                style={{ color: 'var(--color-gainsboro)', fontSize: 12, opacity: 0.9 }}
              >
                정렬
              </label>
              <select
                id="shop-sort"
                className="cy-select"
                defaultValue={
                  (typeof window !== 'undefined'
                    ? new URLSearchParams(window.location.search).get('sort')
                    : null) || 'price-asc'
                }
                onChange={(e) => {
                  // ✅ 새로고침 없이 적용: URL만 교체, 리스트는 즉시 정렬하여 재렌더
                  const v = e.target.value as 'price-asc' | 'price-desc' | 'name-asc';

                  // 1) URL 쿼리만 리로드 없이 갱신
                  const url = new URL(window.location.href);
                  url.searchParams.set('sort', v);
                  window.history.replaceState({}, '', url.toString());

                  // 2) 현재 items를 즉시 정렬해서 재렌더 트리거
                  setItems((prev) => {
                    const next = [...prev];
                    switch (v) {
                      case 'price-desc':
                        return next.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
                      case 'name-asc':
                        return next.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                      case 'price-asc':
                      default:
                        return next.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
                    }
                  });
                }}
              >
                <option value="price-asc">가격 낮은순</option>
                <option value="price-desc">가격 높은순</option>
                <option value="name-asc">이름 오름차순</option>
              </select>

              {/* ▶ 인벤토리 드로어 열기 버튼 (해시 기반) */}
              <a
                href="#inv"
                className="cy-button--accent"
                style={{
                  marginLeft: 8,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--bp-accent)',
                  background: 'transparent',
                  color: 'var(--color-gainsboro)',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                인벤토리
              </a>
            </div>
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
                {
                  // (초기 진입 시 쿼리 기준 정렬, onChange 시 setItems로 즉시 반영)
                  (() => {
                    const sortKey =
                      (typeof window !== 'undefined'
                        ? new URLSearchParams(window.location.search).get('sort')
                        : null) || 'price-asc';

                    const sorted = [...items].sort((a, b) => {
                      switch (sortKey) {
                        case 'price-desc':
                          return (b.price ?? 0) - (a.price ?? 0);
                        case 'name-asc':
                          return (a.name || '').localeCompare(b.name || '');
                        case 'price-asc':
                        default:
                          return (a.price ?? 0) - (b.price ?? 0);
                      }
                    });

                    return sorted;
                  })().map((item) => (
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
                  ))
                }
              </div>
            )}
          </div>
        </section>

        {/* ─ Inventory Drawer (우측 슬라이드 / 모바일 바텀시트) ─ */}
        <div id="inv" className="inv-drawer" role="dialog" aria-modal="true">
          {/* 오버레이 - 클릭 시 닫기 (해시 제거) */}
          <a href="#" className="inv-drawer__overlay" aria-label="닫기" />

          <div className="inv-drawer__panel" onClick={(e) => e.stopPropagation()}>
            <div className="inv-drawer__header">
              <h2 className="panel__title">INVENTORY LOG</h2>
              <a href="#" className="inv-drawer__close" aria-label="닫기">✕</a>
            </div>

            <div className="inv-drawer__content">
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
                            {new Date(e.acquiredAt).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </Main>
  );
};

export default ShopPage;