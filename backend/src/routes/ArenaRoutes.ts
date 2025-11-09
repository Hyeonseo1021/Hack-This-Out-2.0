import express from 'express';
import {
  createArena,
  getArenas,
  getArenaById,
  getArenaHistory,
  getArenaResult
} from '../controllers/ArenaController';
import { verifyToken } from '../middlewares/Token';

const ArenaRoutes = express.Router();

ArenaRoutes.post('/create', verifyToken, createArena);
ArenaRoutes.get('/list', getArenas);
ArenaRoutes.get('/history', verifyToken, getArenaHistory);
ArenaRoutes.get('/:arenaId', getArenaById);
ArenaRoutes.get('/result/:arenaId', verifyToken, getArenaResult);

export default ArenaRoutes;