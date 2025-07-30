import express from 'express';
import { verifyToken } from '../middlewares/Token.js';
import { createArena, joinArena, readyArena, startArena } from '../controllers/ArenaController.js';

const ArenaRoutes = express.Router();

ArenaRoutes.post('/create', createArena);
ArenaRoutes.post('/:arenaId/join', joinArena);
ArenaRoutes.post('/:arenaId/ready', readyArena);
ArenaRoutes.post('/:arenaId/start', startArena);

export default ArenaRoutes;