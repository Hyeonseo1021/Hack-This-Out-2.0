import express from 'express';
import { verifyToken } from '../middlewares/Token.js';
import { createArena, getArenaList, getArenaById, submitFlagArena, receiveArenaVpnIp, getArenaResult, getArenaHistory } from '../controllers/ArenaController';

const ArenaRoutes = express.Router();

ArenaRoutes.get("/history", verifyToken, getArenaHistory);
ArenaRoutes.post('/create', verifyToken, createArena);
ArenaRoutes.get('/list', verifyToken, getArenaList);
ArenaRoutes.get('/:arenaId', verifyToken, getArenaById);
ArenaRoutes.post('/:arenaId/submit', verifyToken, submitFlagArena)
ArenaRoutes.post('/vpn-ip', verifyToken, receiveArenaVpnIp)
ArenaRoutes.get('/:arenaId/result', verifyToken, getArenaResult);


export default ArenaRoutes;