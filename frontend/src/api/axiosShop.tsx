// src/api/axiosShop.ts
import axiosInstance from './axiosInit';
import { ShopItem } from '../types/ShopItem'; // 타입은 기존 그대로 사용

/** 상점 진열 아이템 목록 */
export const getShopItems = async (): Promise<ShopItem[]> => {
  const res = await axiosInstance.get('/shop/'); // GET /shop/items 권장
  // 서버가 배열 자체를 반환(res.json(items))하는 구조 대응
  return res.data?.items ?? res.data;
};

/** 아이템 구매 (유저 토큰 필요) */
export const buyShopItem = async (itemId: string): Promise<string> => {
  const res = await axiosInstance.post(`/shop/buy/${itemId}`);
  return res.data?.msg ?? 'Purchased';
};

/** 내 인벤토리 조회 (유저 토큰 필요) */
export const getInventory = async () => {
  const res = await axiosInstance.get('/shop/inventory');
  return res.data; // [{ _id, user, item: { ...ShopItem }, isUsed, acquiredAt, ... }]
};

/** 인벤토리 아이템 사용 (예: 닉변권, 부스터 활성화) */
export const useInventoryItem = async (invId: string): Promise<string> => {
  const res = await axiosInstance.patch(`/shop/inventory/${invId}/use`);
  return res.data?.msg ?? 'Used';
};

/** ---------- 관리자 전용 ---------- */

/** 아이템 생성 (imageUrl도 함께) */
export const createItem = async (payload: {
  name: string;
  price: number;
  description?: string;
  isListed?: boolean;   // 상점 진열 여부 (기본 false 권장)
  imageUrl?: string;    // 이미지 URL
}) => {
  const res = await axiosInstance.post('/shop', payload);
  return res.data; // 생성된 Item
};

/** 아이템 수정 */
export const updateItem = async (
  id: string,
  payload: Partial<{ name: string; price: number; description: string; isListed: boolean; imageUrl: string }>
) => {
  const res = await axiosInstance.put(`/shop/${id}`, payload);
  return res.data;
};

