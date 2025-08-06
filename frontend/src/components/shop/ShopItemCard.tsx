// src/components/shop/ShopItemCard.tsx

import React from 'react';
import '../../assets/scss/shop/ShopItemCard.scss';

interface ShopItem {
  _id: string;
  name: string;
  description: string;
  price: number;
}

interface ShopItemCardProps {
  item: ShopItem;
  onBuy: (itemId: string) => void;
}

const ShopItemCard: React.FC<ShopItemCardProps> = ({ item, onBuy }) => {
  return (
    <div className="shop-item-card">
      <div className="item-content">
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <p className="price">{item.price} Tokens</p>
        <button onClick={() => onBuy(item._id)}>구매하기</button>
      </div>
    </div>
  );
};

export default ShopItemCard;
