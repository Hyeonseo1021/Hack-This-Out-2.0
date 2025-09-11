import express from 'express';
import { verifyToken } from '../middlewares/Token.js';
import { createArena, getArenaList, getArenaById, submitFlagArena } from '../controllers/ArenaController';

const ArenaRoutes = express.Router();

ArenaRoutes.post('/create', verifyToken, createArena);
ArenaRoutes.get('/list', verifyToken, getArenaList);
ArenaRoutes.get('/:arenaId', verifyToken, getArenaById);
ArenaRoutes.post('/:arenaId/submit', verifyToken, submitFlagArena)

export default ArenaRoutes;