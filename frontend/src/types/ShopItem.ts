export interface ShopItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  imageUrl?: string;
  type: string;

  // 아이템 효과 설정
  effect?: {
    hintCount?: number;
    freezeSeconds?: number;
  };

  // 룰렛 설정
  roulette?: {
    enabled?: boolean;
    weight?: number;
  };

  isListed?: boolean;
  createdAt?: string;
  updatedAt?: string;
}