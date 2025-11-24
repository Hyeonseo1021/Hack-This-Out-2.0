import express from 'express';
import { verifyToken } from '../middlewares/Token';
import {
    getItems,
    createItem,
    buyItem,
    getBalance,
    getInventory,
    useInventoryItem,
    getShopItems,
    buyShopItem,
    spinRoulette,
    uploadItemImage,
    deleteItem
} from "../controllers/ItemController";
import { verifyAdmin } from '../middlewares/Admin';
import { uploadItemImage as uploadMiddleware } from '../middlewares/Upload';

const ItemRoutes = express.Router();

ItemRoutes.get("/balance", verifyToken, getBalance);

ItemRoutes.get("/items", getShopItems); // 상점 아이템 조회
ItemRoutes.post("/buy", verifyToken, buyShopItem); // 상점 아이템 구매

ItemRoutes.post("/roulette/spin", verifyToken, spinRoulette); // 룰렛 돌리기

ItemRoutes.get("/inventory", verifyToken, getInventory); // 인벤토리 조회
ItemRoutes.patch('/inventory/:invId/use', verifyToken, useInventoryItem); // 아이템 사용

// 이미지 업로드 (관리자 전용)
ItemRoutes.post("/upload-image", verifyToken, verifyAdmin, uploadMiddleware.single('image'), uploadItemImage);

ItemRoutes.post("/item", verifyToken, verifyAdmin, createItem); // 아이템 생성
ItemRoutes.delete("/item/:id", verifyToken, verifyAdmin, deleteItem); // 아이템 삭제 (관리자 전용)
ItemRoutes.post("/buy/:id", verifyToken, buyItem); // 일반 아이템 구매

export default ItemRoutes;