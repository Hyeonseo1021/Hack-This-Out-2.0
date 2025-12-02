import mongoose from "mongoose";

const InventorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item", 
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0,
    },
    acquiredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

InventorySchema.index({ user: 1, item: 1 }, { unique: true });

const Inventory = mongoose.model("Inventory", InventorySchema);

export default Inventory;