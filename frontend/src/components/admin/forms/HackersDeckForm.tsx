import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/HackersDeckForm.scss';

interface CardData {
  name: string;
  cost: number;
  effect: string;
  value: number;
}

interface HackersDeckData {
  totalTurns: number;
  startingPoints: number;
  cards: CardData[];
}

interface Props {
  data: HackersDeckData;
  onChange: (data: HackersDeckData) => void;
}

const HackersDeckForm: React.FC<Props> = ({ data, onChange }) => {
  
  const addCard = () => {
    onChange({
      ...data,
      cards: [
        ...data.cards,
        { name: '', cost: 5, effect: 'GAIN_INFO', value: 10 }
      ]
    });
  };

  const removeCard = (index: number) => {
    onChange({
      ...data,
      cards: data.cards.filter((_, i) => i !== index)
    });
  };

  const updateCard = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      cards: data.cards.map((c, i) => 
        i === index ? { ...c, [field]: value } : c
      )
    });
  };

  return (
    <div className="hackers-deck-form">
      <h3>Hacker's Deck Settings</h3>

      <div className="form-grid-2">
        <div className="form-field">
          <label>Total Turns</label>
          <input
            type="number"
            min={5}
            max={30}
            value={data.totalTurns}
            onChange={e => onChange({ ...data, totalTurns: Number(e.target.value) })}
            required
          />
        </div>

        <div className="form-field">
          <label>Starting Points</label>
          <input
            type="number"
            min={50}
            max={500}
            value={data.startingPoints}
            onChange={e => onChange({ ...data, startingPoints: Number(e.target.value) })}
            required
          />
        </div>
      </div>

      {/* Cards */}
      <div>
        <div className="section-header">
          <label>Cards ({data.cards.length})</label>
          <button type="button" onClick={addCard}>
            <FaPlus /> Add Card
          </button>
        </div>

        {data.cards.map((card, idx) => (
          <div key={idx} className="card-item">
            <div className="card-header">
              <span>Card {idx + 1}</span>
              <button type="button" onClick={() => removeCard(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="card-inputs">
              <input
                type="text"
                placeholder="Card name"
                value={card.name}
                onChange={e => updateCard(idx, 'name', e.target.value)}
                required
              />
              
              <input
                type="number"
                placeholder="Cost"
                min={0}
                value={card.cost}
                onChange={e => updateCard(idx, 'cost', Number(e.target.value))}
              />

              <select
                value={card.effect}
                onChange={e => updateCard(idx, 'effect', e.target.value)}
              >
                <option value="GAIN_INFO">Gain Info</option>
                <option value="ATTACK">Attack</option>
                <option value="DEFENSE">Defense</option>
                <option value="STEAL">Steal</option>
                <option value="BLOCK">Block</option>
              </select>

              <input
                type="number"
                placeholder="Value"
                min={0}
                value={card.value}
                onChange={e => updateCard(idx, 'value', Number(e.target.value))}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HackersDeckForm;