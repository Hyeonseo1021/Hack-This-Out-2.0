import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema(
  {
    name: {
      ko: {
        type: String,
        required: true,
      },
      en: {
        type: String,
        required: true,
      },
    },
    description: {
      ko: {
        type: String,
        required: true,
      },
      en: {
        type: String,
        required: true,
      },
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    icon: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      required: true,  // enum 없음, 자유롭게 확장 가능
    },
    
    // 아이템 효과 설정
    effect: {
      hintCount: {
        type: Number,
        default: 0,    // hint: 1, hint_bundle: 3 등
      },
      freezeSeconds: {
        type: Number,
        default: 0,    // time_freeze: 30 등
      },
      scoreBoost: {
        type: Number,
        default: 0,    // score_boost: 50 (50% 증가)
      },
      invincibleSeconds: {
        type: Number,
        default: 0,    // invincible: 10 (10초 무적)
      },
    },
    
    // 룰렛 설정
    roulette: {
      enabled: {
        type: Boolean,
        default: false,  // 룰렛에 포함 여부
      },
      weight: {
        type: Number,
        default: 0,      // 확률 가중치 (소수점, 전체 합계 = 1)
        min: 0,
        max: 1,          // 최대 1 (100%)
      },
    },
    
    isListed: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Item = mongoose.model('Item', ItemSchema);

export default Item;