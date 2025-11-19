import express from 'express';
import {
  // Arena 관련
  createArena,
  getArenas,
  getArenaById,
  getArenaHistory,
  getArenaResult,
  checkArenaParticipation,
  getAllArenas,
  getActiveArenas,
  deleteArena,
  
  // Scenario 관련 (관리자 전용)
  getAllScenarios,
  getScenarioById,
  createScenario,
  updateScenario,
  deleteScenario,
  toggleScenarioActive,
  getScenariosByMode,
  getScenarioStats
} from '../controllers/ArenaController';
import { verifyToken } from '../middlewares/Token';
import { verifyAdmin } from '../middlewares/Admin';

const ArenaRoutes = express.Router();

ArenaRoutes.post('/create', verifyToken, createArena);
ArenaRoutes.get('/list', getArenas);
ArenaRoutes.get('/history', verifyToken, getArenaHistory);
ArenaRoutes.get('/:arenaId/check-participation', verifyToken, checkArenaParticipation);
ArenaRoutes.get('/result/:arenaId', verifyToken, getArenaResult);
ArenaRoutes.get('/arenas', getAllArenas);
ArenaRoutes.get('/active', getActiveArenas);
ArenaRoutes.delete('/:arenaId', deleteArena);

ArenaRoutes.get('/scenarios/stats', verifyToken, verifyAdmin, getScenarioStats);
ArenaRoutes.get('/scenarios/mode/:mode', verifyToken, verifyAdmin, getScenariosByMode);
ArenaRoutes.get('/scenarios', verifyToken, verifyAdmin, getAllScenarios);
ArenaRoutes.get('/scenarios/:id', verifyToken, verifyAdmin, getScenarioById);
ArenaRoutes.post('/scenarios', verifyToken, verifyAdmin, createScenario);
ArenaRoutes.put('/scenarios/:id', verifyToken, verifyAdmin, updateScenario);
ArenaRoutes.patch('/scenarios/:id/toggle', verifyToken, verifyAdmin, toggleScenarioActive);
ArenaRoutes.delete('/scenarios/:id', verifyToken, verifyAdmin, deleteScenario);

ArenaRoutes.get('/:arenaId', getArenaById);


export default ArenaRoutes;