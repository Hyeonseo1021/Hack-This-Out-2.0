// src/api/axiosShop.tsx
import axiosInstance from './axiosInit';
import { ShopItem } from '../types/ShopItem';


export const getBalance = async (): Promise<{ balance: number }> => {
  const res = await axiosInstance.get('/shop/balance'); // ✅ GET /api/item/balance
  return {
    balance: res.data?.balance ?? 0,
  };
};


export const getShopItems = async (): Promise<ShopItem[]> => {
  const res = await axiosInstance.get('/shop/items'); // ✅ GET /api/item/shop/items
  return res.data?.items ?? [];
};


export const buyShopItem = async (
  itemId: string
): Promise<{ 
  msg: string; 
  updatedBalance: number;
  acquiredItem?: { id: string; name: string };
}> => {
  const res = await axiosInstance.post('/shop/buy', { itemId }); // ✅ POST /api/item/shop/buy
  return {
    msg: res.data?.msg ?? '구매 완료',
    updatedBalance: res.data?.updatedBalance ?? 0,
    acquiredItem: res.data?.acquiredItem,
  };
};


export const getInventory = async (): Promise<
  Array<{
    _id: string;
    item: {
      _id: string;
      name: string;
      description: string;
      price: number;
      icon: string;
      type: string;
    };
    quantity: number;
    acquiredAt: string;
  }>
> => {
  const res = await axiosInstance.get('/shop/inventory'); // ✅ GET /api/item/inventory
  return res.data?.inventory ?? [];
};

export const useInventoryItem = async (
  invId: string
): Promise<{ msg: string; remainingQuantity: number }> => {
  const res = await axiosInstance.patch(`/shop/inventory/${invId}/use`); // ✅ PATCH /api/item/inventory/:invId/use
  return { 
    msg: res.data?.msg ?? '아이템을 사용했습니다.',
    remainingQuantity: res.data?.remainingQuantity ?? 0,
  };
};


export const spinRoulette = async (): Promise<{
  rewardId: string;
  rewardName: string;
  updatedBalance: number;
}> => {
  const res = await axiosInstance.post('/item/roulette/spin'); // ✅ POST /api/item/roulette/spin
  return {
    rewardId: res.data?.rewardId ?? '',
    rewardName: res.data?.rewardName ?? '',
    updatedBalance: res.data?.updatedBalance ?? 0,
  };
};


export const createItem = async (payload: {
  name: string;
  price: number;
  description?: string;
  isListed?: boolean;
  icon?: string;
  type?: string;
}) => {
  const res = await axiosInstance.post('/shop', payload); // ✅ POST /api/item (관리자 전용)
  return res.data;
};


