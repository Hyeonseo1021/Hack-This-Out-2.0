import { Request, Response } from "express";
import mongoose from "mongoose";
import Item from "../models/Item";
import User from "../models/User";
import Inventory from "../models/Inventory";

export const getItems = async (req: Request, res: Response): Promise<void> => {
    try {
        const items = await Item.find().sort({ createdAt: -1 });
        res.status(200).json(items);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Failed to fetch Items.'})
    }
};

export const createItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, price, description, isListed } = req.body;
        const newItem = new Item({ name, price, description, isListed });
        await newItem.save();
        res.status(201).json(newItem);
    } catch (err) {
        res.status(500).json({ msg: "Failed to create item."})
    }
}

export const buyItem = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const userId = res.locals.jwtData.id;

    const item = await Item.findById(id).session(session);
    if (!item || !item.isListed) {
      await session.abortTransaction();
      res.status(404).json({ msg: "No item." });
      return;
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      res.status(404).json({ msg: "No user." });
      return;
    }

    if (user.htoCoin < item.price) {
      await session.abortTransaction();
      res.status(400).json({ msg: "코인이 부족합니다." });
      return;
    }

    user.htoCoin -= item.price;
    await user.save({ session });

    const inv = new Inventory({ user: userId, item: item._id });
    await inv.save({ session });

    await session.commitTransaction();
    res.status(200).json({ msg: "Completed to buy item." });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    res.status(500).json({ msg: "Failed to buy Item." });
  } finally {
    session.endSession();
  }
};

export const getInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData.id;
    const items = await Inventory.find({ user: userId })
      .populate('item')
      .sort({ acquiredAt: -1 });

    res.status(200).json({ message: 'OK', inventory: items });
  } catch (err) {
    console.error('❌ getInventory error:', err);
    res.status(500).json({ message: 'ERROR', msg: '서버 오류' });
  }
};

/** 🧩 인벤토리 아이템 사용 */
export const useInventoryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData.id;
    const { invId } = req.params;

    const inventoryItem = await Inventory.findOne({ _id: invId, user: userId }).populate('item');

    if (!inventoryItem) {
      res.status(404).json({ message: 'ERROR', msg: '아이템을 찾을 수 없습니다.' });
      return;
    }

    if (inventoryItem.quantity <= 0) {
      res.status(400).json({ message: 'ERROR', msg: '아이템 수량이 부족합니다.' });
      return;
    }

    inventoryItem.quantity -= 1;
    await inventoryItem.save();

    const itemName = (inventoryItem.item as any)?.name || '아이템';
    res.status(200).json({ message: 'OK', msg: `${itemName}을(를) 사용했습니다.` });
  } catch (err) {
    console.error('❌ useInventoryItem error:', err);
    res.status(500).json({ message: 'ERROR', msg: '서버 오류' });
  }
};

export const getShopItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await Item.find({ isListed: true }).sort({ price: 1 });
    res.status(200).json({ message: 'OK', items });
  } catch (err) {
    console.error('❌ getShopItems error:', err);
    res.status(500).json({ message: 'ERROR', msg: '서버 오류' });
  }
};

/** 🛒 아이템 구매 처리 */
export const buyShopItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData?.id;
    const { itemId } = req.body;

    if (!userId || !itemId) {
      res.status(400).json({ message: 'ERROR', msg: '요청 정보가 올바르지 않습니다.' });
      return;
    }

    const user = await User.findById(userId);
    const item = await Item.findById(itemId);

    if (!user || !item) {
      res.status(404).json({ message: 'ERROR', msg: '유저 또는 아이템을 찾을 수 없습니다.' });
      return;
    }

    // 💰 잔액 확인
    if (user.htoCoin < item.price) {
      res.status(400).json({ message: 'ERROR', msg: '보유 코인이 부족합니다.' });
      return;
    }

    // 💸 코인 차감
    user.htoCoin -= item.price;
    await user.save();

    // 🎲 랜덤 버프 처리
    let finalItem = item;
    if (item.type === 'random_buff') {
      const rand = Math.random();
      const randomResult = rand < 0.7 ? '힌트권 1회권' : '시간 정지권';
      const randomItem = await Item.findOne({ name: randomResult });
      if (randomItem) finalItem = randomItem;
    }

    // 🎁 인벤토리 확인 후 처리
    const existing = await Inventory.findOne({
      user: user._id,
      item: finalItem._id,
    });

    if (existing) {
      existing.quantity = (existing.quantity ?? 0) + 1;
      await existing.save();
    } else {
      await Inventory.create({
        user: user._id,
        item: finalItem._id,
        itemName: finalItem.name,
        isUsed: false,
        acquiredAt: new Date(),
        quantity: 1,
      });
    }

    res.status(200).json({
      message: 'OK',
      msg: `${finalItem.name}을(를) 획득했습니다!`,
      updatedTokens: user.htoCoin,
    });
  } catch (err) {
    console.error('❌ buyShopItem error:', err);
    res.status(500).json({ message: 'ERROR', msg: '서버 오류가 발생했습니다.' });
  }
};