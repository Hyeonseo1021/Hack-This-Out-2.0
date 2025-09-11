import express from 'express';
import { verifyToken } from '../middlewares/Token.js';
import { 
    getItems, 
    createItem, 
    buyItem, 
    getInventory,
} from "../controllers/ItemController";
import { verifyAdmin } from '../middlewares/Admin.js';

const ItemRoutes = express.Router();
ItemRoutes.post("/", verifyToken, verifyAdmin, createItem);
ItemRoutes.get("/", verifyToken, getItems);
ItemRoutes.post("/buy/:id", verifyToken, buyItem);
ItemRoutes.get("/inventory", verifyToken, getInventory);


export default ItemRoutes;
