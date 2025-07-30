// socket.ts
import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { registerArenaSocketHandlers } from '../controllers/ArenaController';

interface ClientToServerEvents {
// Arena 관련
  'arena:join': (data: { arenaId: string; userId: string }) => void;
  'arena:ready': (data: { arenaId: string; userId: string; isReady: boolean }) => void;
  'arena:start': (data: { arenaId: string }) => void;
  'arena:submit-flag': (data: { arenaId: string; userId: string; flag: string }) => void;

  // Match 관련
  'match:join': (data: { matchId: string; userId: string }) => void;
  'match:ready': (data: { matchId: string; userId: string }) => void;
  'match:submit': (data: { matchId: string; userId: string; flag: string }) => void;
  'match:cancel': (data: { matchId: string; userId: string }) => void;
}

interface ServerToClientEvents {
'arena:update-participants': (data: { userId: string; isReady: boolean }[]) => void;
  'arena:all-ready': () => void;
  'arena:start': () => void;
  'arena:update-ranking': (data: { userId: string; rank: number }[]) => void;
  'arena:end': () => void;

  // Match 관련
  'match:start': () => void;
  'match:end': (data: { winnerId: string }) => void;
  'match:update-status': (data: { status: string }) => void;
  'match:update-ranking': (data: { userId: string; rank: number }[]) => void;
}

export let io: Server<ClientToServerEvents, ServerToClientEvents>;

export const initSocketServer = (server: HTTPServer): void => {
  io = new Server(server, {
    cors: {
      origin: process.env.ORIGIN_URL || '*',
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);
    registerArenaSocketHandlers(socket, io);
  });
};
