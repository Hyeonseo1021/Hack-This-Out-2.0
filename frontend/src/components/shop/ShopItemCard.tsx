// src/components/shop/ShopItemCard.tsx
import React from 'react';
import { ShopItem } from '../../types/ShopItem';
import '../../assets/scss/Shop/ShopItemCard.scss'; // 대소문자 경로 확인!

type Props = {
  item: ShopItem;
  onBuy: () => void;
  disabled?: boolean;
};

const ShopItemCard: React.FC<Props> = ({ item, onBuy, disabled }) => {
  return (
    <div className="shop-card">

      <div className="shop-card__body">
        <h3 className="shop-card__title">{item.name}</h3>
        {item.description && <p className="shop-card__desc">{item.description}</p>}

        <div className="shop-card__footer">
          <span className="shop-card__price">{item.price} HTO</span>
          <button
            className="shop-card__buy"
            onClick={onBuy}
            disabled={!!disabled}
            aria-busy={!!disabled}
          >
            {disabled ? '구매중...' : '구매'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShopItemCard;
