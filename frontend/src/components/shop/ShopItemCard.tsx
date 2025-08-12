import React from 'react';
import '../../assets/scss/shop/ShopItemCard.scss';

export interface ShopItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  type: string; // 예: 'hint', 'exp_boost', 'nickname_change'
}

interface ShopItemCardProps {
  item: ShopItem;
  onBuy: () => void;
}

const ShopItemCard: React.FC<ShopItemCardProps> = ({ item, onBuy }) => {
  return (
    <div className="shop-item-card">
      <h3 className="item-name">{item.name}</h3>
      <p className="item-description">{item.description}</p>
      <p className="item-price">{item.price} Tokens</p>
      <button className="buy-button" onClick={onBuy}>
        구매하기
      </button>
    </div>
  );
};

export default ShopItemCard;
