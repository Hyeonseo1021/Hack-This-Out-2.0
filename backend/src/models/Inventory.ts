import mongoose from "mongoose";

/** 🎒 인벤토리 스키마 */
const InventorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShopItem", // ✅ 상점 아이템 참조
      required: true,
    },
    itemName: {
      type: String, // ✅ 아이템 이름 (조회 속도 개선용)
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    acquiredAt: {
      type: Date,
      default: Date.now,
    },
    quantity: {
      type: Number, // ✅ 아이템 개수
      default: 1,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

/** 🎯 모델 인터페이스 (선택적 타입 지원) */
export interface IInventory extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  item: mongoose.Types.ObjectId;
  itemName: string;
  isUsed: boolean;
  acquiredAt: Date;
  quantity: number;
}

/** ✅ 모델 생성 및 내보내기 */
const Inventory = mongoose.model<IInventory>("Inventory", InventorySchema);
export default Inventory;