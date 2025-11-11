import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';

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
    <div>
      <h3 style={{ color: '#00d4ff', marginBottom: '15px' }}>Hacker's Deck Settings</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div>
          <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '4px' }}>
            Total Turns
          </label>
          <input
            type="number"
            min={5}
            max={30}
            value={data.totalTurns}
            onChange={e => onChange({ ...data, totalTurns: Number(e.target.value) })}
            required
          />
        </div>

        <div>
          <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '4px' }}>
            Starting Points
          </label>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ fontSize: '11px', opacity: 0.7 }}>Cards ({data.cards.length})</label>
          <button type="button" onClick={addCard} style={{ padding: '4px 8px', fontSize: '11px' }}>
            <FaPlus /> Add Card
          </button>
        </div>

        {data.cards.map((card, idx) => (
          <div key={idx} style={{ 
            background: '#16213e', 
            padding: '10px', 
            borderRadius: '4px', 
            marginBottom: '8px',
            border: '1px solid #2d2d44'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#999' }}>Card {idx + 1}</span>
              <button 
                type="button" 
                onClick={() => removeCard(idx)}
                style={{ padding: '2px 6px', fontSize: '10px' }}
              >
                <FaTrash />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px' }}>
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