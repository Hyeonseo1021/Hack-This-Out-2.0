
export interface ShopItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  type: string; // 예: 'hint', 'exp_boost', 'nickname_change'
};
