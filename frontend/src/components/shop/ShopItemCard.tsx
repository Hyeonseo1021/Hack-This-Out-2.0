// src/components/shop/ShopItemCard.tsx
import React from "react";
import "../../assets/scss/shop/ShopItemCard.scss";

interface Props {
  item: {
    _id: string;
    name: string;
    description: string;
    price: number;
    icon: string;
  };
  onBuy: (id: string) => void;
}

const ShopItemCard: React.FC<Props> = ({ item, onBuy }) => {
  return (
    <div className="shop-item-card">

      {/* 아이콘 */}
      <img
        src={item.icon}
        alt={item.name}
        className="shop-item-card__icon"
      />

      {/* 제목 + 가격 */}
      <div className="shop-item-card__header">
        <h3 className="shop-item-card__title">{item.name}</h3>
        <span className="shop-item-card__price">{item.price} HTO</span>
      </div>

      {/* 설명 */}
      <p className="shop-item-card__desc">{item.description}</p>

      {/* 구매 버튼 */}
      <div className="shop-item-card__footer">
        <button
          className="shop-item-card__btn"
          onClick={() => onBuy(item._id)}
        >
          구매
        </button>
      </div>

    </div>
  );
};

export default ShopItemCard;