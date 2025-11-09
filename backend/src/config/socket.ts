// socket.ts
import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { registerArenaSocketHandlers } from '../sockets/arenaHandlers';

export const initializeSocket = (server: HTTPServer, app: any) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.ORIGIN_URL, // 프론트 주소로 제한 가능
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log('✅ New client connected:', socket.id);

    registerArenaSocketHandlers(socket, io);
  });
  app.set('io', io);

  return io;
};
