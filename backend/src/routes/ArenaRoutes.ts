import express from 'express';
import { verifyToken } from '../middlewares/Token.js';
import { createArena, getArenaList, getArenaById, submitFlagArena } from '../controllers/ArenaController';


const ArenaRoutes = express.Router();

ArenaRoutes.post('/create', verifyToken, createArena);
ArenaRoutes.get('/list', getArenaList);
ArenaRoutes.get('/:arenaId', getArenaById);
ArenaRoutes.post('/:arenaId/submit', submitFlagArena)

export default ArenaRoutes;