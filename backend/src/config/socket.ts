// socket.ts
import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { registerArenaSocketHandlers } from '../sockets/arenaHandlers';
import { registerTerminalRaceHandlers } from '../sockets/modes/terminalRaceHandler'; 
import { registerDefenseBattleHandlers } from '../sockets/modes/DefenseBattleHandler';
import { registerForensicsRushHandlers } from '../sockets/modes/ForensicsRushHandler';

export const initializeSocket = (server: HTTPServer, app: any) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.ORIGIN_URL,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log('✅ New client connected:', socket.id);

    registerArenaSocketHandlers(socket, io);

    registerTerminalRaceHandlers(io, socket); 

    registerDefenseBattleHandlers(io, socket);

    registerForensicsRushHandlers(io, socket);
  });
  
  app.set('io', io);

  return io;
};