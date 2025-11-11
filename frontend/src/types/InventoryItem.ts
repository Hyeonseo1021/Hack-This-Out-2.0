export interface InventoryItem {
  _id: string;           // 인벤토리 아이템 고유 ID
  name: string;          // 아이템 이름
  description: string;   // 아이템 설명
  quantity: number;      // 보유 개수
}