import express from 'express';
import {
  createArena,
  getArenas,
  getArenaById,
  getArenaHistory,
  getArenaResult,
  checkArenaParticipation
} from '../controllers/ArenaController';
import { verifyToken } from '../middlewares/Token';

const ArenaRoutes = express.Router();

ArenaRoutes.post('/create', verifyToken, createArena);
ArenaRoutes.get('/list', getArenas);
ArenaRoutes.get('/history', verifyToken, getArenaHistory);
ArenaRoutes.get('/:arenaId/check-participation', verifyToken, checkArenaParticipation);
ArenaRoutes.get('/result/:arenaId', verifyToken, getArenaResult);
ArenaRoutes.get('/:arenaId', getArenaById);

export default ArenaRoutes;