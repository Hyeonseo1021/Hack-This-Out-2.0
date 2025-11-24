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
        const { name, price, description, isListed, icon, type, effect, roulette, imageUrl } = req.body;

        // icon과 imageUrl 중 하나라도 있으면 둘 다 설정
        const finalIcon = icon || imageUrl || '';
        const finalImageUrl = imageUrl || icon || '';

        const newItem = new Item({
            name,
            price,
            description: description || '설명 없음',
            isListed: isListed !== undefined ? isListed : true,
            icon: finalIcon,
            imageUrl: finalImageUrl,
            type,
            effect: effect || { hintCount: 0, freezeSeconds: 0 },
            roulette: roulette || { enabled: false, weight: 1 },
        });

        await newItem.save();
        res.status(201).json(newItem);
    } catch (err) {
        console.error('❌ createItem error:', err);
        res.status(500).json({ msg: "Failed to create item."})
    }
}

/** 📤 아이템 이미지 업로드 */
export const uploadItemImage = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ message: 'ERROR', msg: '파일이 업로드되지 않았습니다.' });
            return;
        }

        // 업로드된 파일의 URL 반환
        const imageUrl = `/uploads/items/${req.file.filename}`;

        res.status(200).json({
            message: 'OK',
            imageUrl,
            filename: req.file.filename,
        });
    } catch (err) {
        console.error('❌ uploadItemImage error:', err);
        res.status(500).json({ message: 'ERROR', msg: '이미지 업로드 실패' });
    }
};

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

/** 💰 사용자 코인 잔액 조회 */
export const getBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData.id;
    const user = await User.findById(userId).select('htoCoin');

    if (!user) {
      res.status(404).json({ message: 'ERROR', msg: '사용자를 찾을 수 없습니다.' });
      return;
    }

    res.status(200).json({ 
      message: 'OK', 
      balance: user.htoCoin 
    });
  } catch (err) {
    console.error('❌ getBalance error:', err);
    res.status(500).json({ message: 'ERROR', msg: '서버 오류' });
  }
};

export const getInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData.id;
    const items = await Inventory.find({ user: userId, quantity: { $gt: 0 } }) // 수량 0인 아이템 제외
      .populate('item')
      .sort({ acquiredAt: -1 });

    // ✅ item이 null인 항목 제거 (삭제된 아이템 참조 필터링)
    const validItems = items.filter(inv => inv.item !== null);

    res.status(200).json({ message: 'OK', inventory: validItems });
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
    res.status(200).json({ 
      message: 'OK', 
      msg: `${itemName}을(를) 사용했습니다.`,
      remainingQuantity: inventoryItem.quantity
    });
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = res.locals.jwtData?.id;
    const { itemId } = req.body;

    if (!userId || !itemId) {
      await session.abortTransaction();
      res.status(400).json({ message: 'ERROR', msg: '요청 정보가 올바르지 않습니다.' });
      return;
    }

    const user = await User.findById(userId).session(session);
    const item = await Item.findById(itemId).session(session);

    if (!user || !item) {
      await session.abortTransaction();
      res.status(404).json({ message: 'ERROR', msg: '유저 또는 아이템을 찾을 수 없습니다.' });
      return;
    }

    // 💰 잔액 확인
    if (user.htoCoin < item.price) {
      await session.abortTransaction();
      res.status(400).json({ message: 'ERROR', msg: '보유 코인이 부족합니다.' });
      return;
    }

    // 💸 코인 차감
    user.htoCoin -= item.price;
    await user.save({ session });

    // 🎲 랜덤 버프 처리
    let finalItem = item;
    if (item.type === 'random_buff') {
      const rand = Math.random();
      const randomResult = rand < 0.7 ? '힌트권 1회권' : '시간 정지권';
      const randomItem = await Item.findOne({ name: randomResult }).session(session);
      if (randomItem) finalItem = randomItem;
    }

    // 🎁 인벤토리 확인 후 처리
    const existing = await Inventory.findOne({
      user: user._id,
      item: finalItem._id,
    }).session(session);

    if (existing) {
      existing.quantity = (existing.quantity ?? 0) + 1;
      await existing.save({ session });
    } else {
      await Inventory.create([{
        user: user._id,
        item: finalItem._id,
        quantity: 1,
        acquiredAt: new Date(),
      }], { session });
    }

    await session.commitTransaction();

    res.status(200).json({
      message: 'OK',
      msg: `${finalItem.name}을(를) 획득했습니다!`,
      updatedBalance: user.htoCoin,
      acquiredItem: {
        id: finalItem._id,
        name: finalItem.name,
      }
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('❌ buyShopItem error:', err);
    res.status(500).json({ message: 'ERROR', msg: '서버 오류가 발생했습니다.' });
  } finally {
    session.endSession();
  }
};

/** 🗑️ 아이템 삭제 (관리자 전용) */
export const deleteItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const item = await Item.findByIdAndDelete(id);

    if (!item) {
      res.status(404).json({ message: 'ERROR', msg: '아이템을 찾을 수 없습니다.' });
      return;
    }

    res.status(200).json({ message: 'OK', msg: '아이템이 삭제되었습니다.' });
  } catch (err) {
    console.error('❌ deleteItem error:', err);
    res.status(500).json({ message: 'ERROR', msg: '서버 오류' });
  }
};

/** 🎰 룰렛 아이템 목록 조회 */
export const getRouletteItems = async (req: Request, res: Response): Promise<void> => {
  try {
    // roulette.enabled가 true인 아이템만 가져오기
    const items = await Item.find({ 'roulette.enabled': true })
      .select('_id name icon imageUrl roulette')
      .sort({ 'roulette.weight': -1 }); // 가중치 높은 순으로 정렬

    if (items.length === 0) {
      res.status(404).json({ message: 'ERROR', msg: '룰렛 아이템이 설정되지 않았습니다.' });
      return;
    }

    res.status(200).json({
      message: 'OK',
      items: items.map(item => ({
        id: item._id,
        name: item.name,
        icon: item.icon || item.imageUrl,
        weight: item.roulette?.weight || 1
      }))
    });
  } catch (err) {
    console.error('❌ getRouletteItems error:', err);
    res.status(500).json({ message: 'ERROR', msg: '서버 오류' });
  }
};

/** 🎰 룰렛 돌리기 (DB 기반) */
export const spinRoulette = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = res.locals.jwtData?.id;
    const ROULETTE_COST = 10;

    if (!userId) {
      await session.abortTransaction();
      res.status(400).json({ message: 'ERROR', msg: '로그인이 필요합니다.' });
      return;
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      res.status(404).json({ message: 'ERROR', msg: '유저를 찾을 수 없습니다.' });
      return;
    }

    // 💰 잔액 확인
    if (user.htoCoin < ROULETTE_COST) {
      await session.abortTransaction();
      res.status(400).json({ message: 'ERROR', msg: '코인이 부족합니다! (필요: 10 HTO)' });
      return;
    }

    // 💸 코인 차감
    user.htoCoin -= ROULETTE_COST;
    await user.save({ session });

    // 🎲 DB에서 룰렛 아이템 가져오기
    const rouletteItems = await Item.find({ 'roulette.enabled': true }).session(session);

    if (rouletteItems.length === 0) {
      await session.abortTransaction();
      res.status(404).json({ message: 'ERROR', msg: '룰렛 아이템이 설정되지 않았습니다.' });
      return;
    }

    // 가중치 기반 랜덤 선택
    const totalWeight = rouletteItems.reduce((sum, item) => sum + (item.roulette?.weight || 1), 0);
    const rand = Math.random() * totalWeight;

    let acc = 0;
    let selectedItem = rouletteItems[0];

    for (const item of rouletteItems) {
      acc += item.roulette?.weight || 1;
      if (rand <= acc) {
        selectedItem = item;
        break;
      }
    }

    console.log(`🎰 [Roulette] User ${userId} won: ${selectedItem.name} (weight: ${selectedItem.roulette?.weight})`);

    // 🎁 인벤토리에 추가
    const existing = await Inventory.findOne({
      user: user._id,
      item: selectedItem._id,
    }).session(session);

    if (existing) {
      existing.quantity = (existing.quantity ?? 0) + 1;
      await existing.save({ session });
    } else {
      await Inventory.create([{
        user: user._id,
        item: selectedItem._id,
        quantity: 1,
        acquiredAt: new Date(),
      }], { session });
    }

    await session.commitTransaction();

    res.status(200).json({
      message: 'OK',
      rewardId: selectedItem._id.toString(),
      rewardName: selectedItem.name,
      rewardIcon: selectedItem.icon || selectedItem.imageUrl,
      updatedBalance: user.htoCoin,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('❌ spinRoulette error:', err);
    res.status(500).json({ message: 'ERROR', msg: '서버 오류가 발생했습니다.' });
  } finally {
    session.endSession();
  }
};