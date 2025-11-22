import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import "../../assets/scss/shop/NPCHelp.scss";
import HackCat from "../../assets/img/icon/Hack cat.png";

interface NPCHelpProps {
  open: boolean;
  onClose: () => void;
}

const NPCHelp: React.FC<NPCHelpProps> = ({ open, onClose }) => {
  const { t } = useTranslation("shop");
  const [selected, setSelected] = useState<string | null>(null);

  if (!open) return null;

  /* === FAQ 목록 === */
  const faqList = [
    {
      key: "shop",
      question: t("npc.faq.shop.question"),
      answer: t("npc.faq.shop.answer"),
    },
    {
      key: "roulette",
      question: t("npc.faq.roulette.question"),
      answer: t("npc.faq.roulette.answer"),
    },
    {
      key: "inventory",
      question: t("npc.faq.inventory.question"),
      answer: t("npc.faq.inventory.answer"),
    },
    {
      key: "coin",
      question: t("npc.faq.coin.question"),
      answer: t("npc.faq.coin.answer"),
    },
    {
      key: "chance",
      question: t("npc.faq.chance.question"),
      answer: t("npc.faq.chance.answer"),
    },
  ];

  /* === 선택된 답변 === */
  const selectedAnswer = faqList.find((item) => item.key === selected)?.answer;

  return (
    <div className="npc-help-box">
      <div className="npc-inner">

        {/* 해커냥 이미지 */}
        <div className="npc-avatar">
          <img src={HackCat} alt="HackCat" />
        </div>

        {/* 인사 메시지 */}
        <div className="npc-message">
          <p><strong>{t("npc.intro.hello")}</strong></p>
          <p>{t("npc.intro.ask")}</p>
        </div>

        {/* FAQ 목록 버튼 */}
        <div className="npc-faq-list">
          {faqList.map((item) => (
            <button
              key={item.key}
              className="faq-btn"
              onClick={() => setSelected(item.key)}
            >
              {item.question}
            </button>
          ))}
        </div>

        {/* 답변 박스 */}
        {selectedAnswer && (
          <div className="npc-answer-box">
            {selectedAnswer.split("\n").map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>
        )}

        {/* 닫기 버튼 */}
        <button className="npc-close-btn" onClick={onClose}>
          {t("npc.buttons.close")}
        </button>

      </div>
    </div>
  );
};

export default NPCHelp;
