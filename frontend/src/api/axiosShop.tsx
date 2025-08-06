// src/api/axiosShop.ts

import axiosInstance from './axiosInit';
import { ShopItem } from '../types/ShopItem';

// 상점 아이템 목록 가져오기
export const getShopItems = async (): Promise<ShopItem[]> => {
  try {
    const res = await axiosInstance.get('/shop');
    return res.data.items;
  } catch (error: any) {
    throw new Error(error.response?.data?.msg || 'Failed to load shop items');
  }
};

// 상점 아이템 구매 요청
export const buyShopItem = async (itemId: string): Promise<string> => {
  try {
    const res = await axiosInstance.post(`/shop/buy/${itemId}`);
    return res.data.msg;
  } catch (error: any) {
    throw new Error(error.response?.data?.msg || 'Failed to purchase item');
  }
};
