import mongoose from "mongoose";
const ItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        default: ''
    },
    isListed: {
        type: Boolean,
        default: false
    },
}, {
    timestamps: true
});

const Item = mongoose.model('Item', ItemSchema);

export default Item;
