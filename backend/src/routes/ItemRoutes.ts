import express from 'express';
import { verifyToken } from '../middlewares/Token';
import { 
    getItems, 
    createItem, 
    buyItem, 
    getInventory,
    useInventoryItem,
    getShopItems,
    buyShopItem
} from "../controllers/ItemController";
import { verifyAdmin } from '../middlewares/Admin';
import Item from '../models/Item';

const ItemRoutes = express.Router();

// 상점 아이템 관리
ItemRoutes.get("/shop/items", getShopItems); // 상점 아이템 조회
ItemRoutes.post("/shop/buy", verifyToken, buyShopItem); // 상점 아이템 구매

// 인벤토리 관리
ItemRoutes.get("/inventory", verifyToken, getInventory); // 인벤토리 조회
ItemRoutes.patch('/inventory/:invId/use', verifyToken, useInventoryItem); // 아이템 사용

// 관리자를 위한 아이템 생성
ItemRoutes.post("/", verifyToken, verifyAdmin, createItem); // 아이템 생성
ItemRoutes.post("/buy/:id", verifyToken, buyItem); // 일반 아이템 구매

export default ItemRoutes;
