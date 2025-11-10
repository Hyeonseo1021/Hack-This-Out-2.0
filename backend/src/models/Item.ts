import mongoose from "mongoose";
const ItemSchema = new mongoose.Schema({
    name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['hint', 'hint_bundle', 'time_freeze', 'random_buff'],
    required: true
  },
  isListed: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Item = mongoose.model('Item', ItemSchema);

export default Item;
