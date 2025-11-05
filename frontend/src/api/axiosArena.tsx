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

// 수정된 부분: userId 제거, machineId 추가
export const submitFlagArena = async (arenaId: string, flag: string, machineId: string) => {
  const res = await axiosInstance.post(`/arena/${arenaId}/submit`, {
    flag,
    machineId,
  });
  return res.data;
};

// VPN IP 전송 함수 추가
export const sendArenaVpnIp = async (arenaId: string, vpnIp: string) => {
  const res = await axiosInstance.post('/arena/vpn-ip', {
    arenaId,
    vpnIp,
  });
  return res.data;
};


export const getArenaResult = async (arenaId: string) => {
  try {
    const res = await axiosInstance.get(`/arena/${arenaId}/result`);
    return res.data;
  } catch (error: any) {
    throw error?.response?.data || new Error('Failed to fetch arena results');
  }
};

export const getArenaHistory = async () => {
  const res = await axiosInstance.get("/arena/history", { withCredentials: true });
  return res.data;
};
// 이후 추가로 필요한 기능 예시:
// export const joinArena = ...
// export const startArena = ...