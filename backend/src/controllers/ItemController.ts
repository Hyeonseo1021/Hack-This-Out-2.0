import { Request, Response } from "express";
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
    try {
        const { id } = req.params;
        const userId = res.locals.jwtData.id;

        const item = await Item.findById(id);
        if (!item || !item.isListed) {
            res.status(404).json({ msg: "No item." });
            return;
        }

        const user = await User.findById(userId);
        if (!user) res.status(404).json({ msg: "No user." });

        if (user.htoCoin < item.price) {
            res.status(400).json({ msg: "lacked Coin." });
        }

        user.htoCoin -= item.price;
        await user.save();

        const inv = new Inventory({
            user: userId,
            item: item._id,
        });
        await inv.save();
        res.status(200).json({ msg: "Completed to buy item." });
    } catch (err) {
        res.status(500).json({ msg: "Failed to buy Item." });
    }
};

export const getInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.jwtData.id;
    const inventory = await Inventory.find({ user: userId })
      .populate("item");
    res.status(200).json(inventory);
  } catch (err) {
    res.status(500).json({ msg: "인벤토리 불러오기 실패" });
  }
};
