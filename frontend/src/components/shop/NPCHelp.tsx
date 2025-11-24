// NPCHelp.tsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import "../../assets/scss/shop/NPCHelp.scss";
import HackCat from "../../assets/img/icon/Hack_cat.png";

interface NPCHelpProps {
  open: boolean;
  onClose: () => void;
}

const NPCHelp: React.FC<NPCHelpProps> = ({ open, onClose }) => {
  const { t, i18n } = useTranslation("shop");
  const [selected, setSelected] = useState<string | null>(null);

  if (!open) return null;

  const faqList = [
    { key: "shop", question: t("npc.faq.shop.question"), answer: t("npc.faq.shop.answer") },
    { key: "roulette", question: t("npc.faq.roulette.question"), answer: t("npc.faq.roulette.answer") },
    { key: "inventory", question: t("npc.faq.inventory.question"), answer: t("npc.faq.inventory.answer") },
    { key: "coin", question: t("npc.faq.coin.question"), answer: t("npc.faq.coin.answer") },
    { key: "chance", question: t("npc.faq.chance.question"), answer: t("npc.faq.chance.answer") },
  ];

  const selectedAnswer = faqList.find((item) => item.key === selected)?.answer;

  return (
    <div className="npc-help-box">
      <div className="npc-inner">
        <div className="npc-avatar">
          <img src={HackCat} alt="HackCat" />
        </div>

        <div className="npc-message">
          <p><strong>{i18n.language === "ko" ? t("npc.intro.hello") : t("npc.intro.hello")}</strong></p>
          <p>{i18n.language === "ko" ? t("npc.intro.ask") : t("npc.intro.ask")}</p>
        </div>

        <div className="npc-faq-list">
          {faqList.map((item) => (
            <button
              key={item.key}
              className={`faq-btn ${selected === item.key ? "active" : ""}`}
              onClick={() => setSelected(item.key)}
            >
              {item.question}
            </button>
          ))}
        </div>

        {selectedAnswer && (
          <div className="npc-answer-box">
            {selectedAnswer.split("\n").map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>
        )}

        <button className="npc-close-btn" onClick={onClose}>
          {t("npc.buttons.close")}
        </button>
      </div>
    </div>
  );
};

export default NPCHelp;
