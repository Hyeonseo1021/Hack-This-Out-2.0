import { io } from 'socket.io-client';

// VITE_API_URL에서 포트 추출 (예: http://localhost:5001/api -> http://localhost:5001)
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const socketUrl = apiUrl.replace(/\/api$/, '');

const socket = io(socketUrl, {
  transports: ['websocket'],
  withCredentials: true,
});

export default socket;
