// src/components/shop/ShopGuide.tsx
import React, { useState } from "react";
import "../../assets/scss/Shop/ShopGuide.scss";

const ShopGuide: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="shop-guide">
      <button className="guide-toggle" onClick={() => setOpen(!open)}>
        {open ? "▲ 상점 이용 가이드 닫기" : "▼ 상점 이용 가이드 보기"}
      </button>
      {open && (
        <div className="guide-content">
          <h2>상점 이용 가이드</h2>
          <ol>
            <li>문제를 풀고 경기에서 승리하면 <strong>코인</strong>을 얻습니다.</li>
            <li>코인은 상점에서 아이템을 구매하는 데 사용됩니다.</li>
            <li>아이템 종류:
              <ul>
                <li>힌트 (문제 풀이에 도움)</li>
                <li>경험치 부스터 (EXP 보너스)</li>
                <li>닉네임 변경/색상 변경 (프로필 꾸미기)</li>
                <li>룰렛 (랜덤 아이템 획득, 확률 고지)</li>
              </ul>
            </li>
            <li>구매한 아이템은 <strong>내 인벤토리</strong>에서 확인 및 사용 가능합니다.</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default ShopGuide;