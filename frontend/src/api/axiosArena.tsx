// src/api/axiosArena.ts
import axiosInstance from './axiosInit';

export const getArenaList = async () => {
  try {
    const res = await axiosInstance.get('/arena/list');
    console.log('[getArenaList] Response:', res.data);
    
    // ✅ 수정: 백엔드가 배열을 직접 반환하므로 res.data를 그대로 사용
    return res.data;
  } catch (error: any) {
    console.error('[getArenaList] Error:', error);
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

export const submitFlagArena = async (arenaId: string, flag: string, machineId: string) => {
  const res = await axiosInstance.post(`/arena/${arenaId}/submit`, {
    flag,
    machineId,
  });
  return res.data;
};

export const sendArenaVpnIp = async (arenaId: string, vpnIp: string) => {
  const res = await axiosInstance.post('/arena/vpn-ip', {
    arenaId,
    vpnIp,
  });
  return res.data;
};

export const getArenaResult = async (arenaId: string) => {
  try {
    const res = await axiosInstance.get(`/arena//result/${arenaId}`);
    return res.data;
  } catch (error: any) {
    throw error?.response?.data || new Error('Failed to fetch arena results');
  }
};

export const getArenaHistory = async () => {
  const res = await axiosInstance.get("/arena/history", { withCredentials: true });
  return res.data;
};

export const checkArenaParticipation = async (arenaId: string) => {
  const res = await axiosInstance.get(`/arena/${arenaId}/check-participation`);
  return res.data;
}
// ===== 관리자 전용 함수들 =====

/**
 * 모든 아레나 방 조회 (관리자용)
 */
export const getAllArenas = async () => {
  try {
    const res = await axiosInstance.get('/arena/arenas');
    console.log('[getAllRooms] Response:', res.data);
    return res.data;
  } catch (error: any) {
    console.error('[getAllRooms] Error:', error);
    throw error?.response?.data || new Error('Failed to fetch all rooms');
  }
};

/**
 * 방 삭제 (관리자 전용)
 */
export const deleteArena = async (arenaId: string) => {
  try {
    const res = await axiosInstance.delete(`/arena/${arenaId}`);
    return res.data;
  } catch (error: any) {
    console.error('[deleteRoom] Error:', error);
    throw error?.response?.data || new Error('Failed to delete room');
  }
};

/**
 * 활성 방 목록 조회 (WAITING 또는 STARTED 상태)
 */
export const getActiveRooms = async () => {
  try {
    const res = await axiosInstance.get('/arena/active');
    return res.data;
  } catch (error: any) {
    console.error('[getActiveRooms] Error:', error);
    throw error?.response?.data || new Error('Failed to fetch active rooms');
  }
};