// src/api/axiosArena.ts
import axiosInstance from './axiosInit';

export const getArenaList = async () => {
  try {
    const res = await axiosInstance.get('/arena/list');
    return res.data;
  } catch (error: any) {
    throw error?.response?.data || new Error('Failed to fetch arena list');
  }
};

export const createArena = async (arenaData: any) => {
  try {
    const res = await axiosInstance.post('/arena/create', arenaData);
    return res.data;
  } catch (error: any) {
    throw error?.response?.data || new Error('Failed to create arena');
  }
};

export const getArenaById = async (arenaId: string) => {
  try {
    const res = await axiosInstance.get(`/arena/${arenaId}`);
    return res.data;
  } catch (error: any) {
    throw error?.response?.data || new Error('Failed to fetch arena info');
  }
};

export const submitFlagArena = async (arenaId: string, userId: string, flag: string) => {
  const res = await axiosInstance.post(`/arena/${arenaId}/submit`, {
    userId,
    flag,
  });
  return res.data;
};

// 이후 추가로 필요한 기능 예시:
// export const joinArena = ...
// export const startArena = ...
