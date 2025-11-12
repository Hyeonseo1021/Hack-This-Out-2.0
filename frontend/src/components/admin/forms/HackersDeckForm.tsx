import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/forms/HackersDeckForm.scss';

interface AttackCard {
  name: string;
  cost: number;
  damage: number;
  effect?: string;
}

interface DefenseCard {
  name: string;
  cost: number;
  shield?: number;
  heal?: number;
  effect?: string;
}

interface SpecialCard {
  name: string;
  cost: number;
  effect: string;
}

interface HackersDeckData {
  deck: {
    attack: AttackCard[];
    defense: DefenseCard[];
    special: SpecialCard[];
  };
  startingHand: number;
  startingEnergy: number;
  maxTurns: number;
  victoryCondition: string;
}

interface Props {
  data: HackersDeckData;
  onChange: (data: HackersDeckData) => void;
}

const HackersDeckForm: React.FC<Props> = ({ data, onChange }) => {
  
  // Attack Cards
  const addAttackCard = () => {
    onChange({
      ...data,
      deck: {
        ...data.deck,
        attack: [
          ...data.deck.attack,
          { name: '', cost: 3, damage: 20 }
        ]
      }
    });
  };

  const removeAttackCard = (index: number) => {
    onChange({
      ...data,
      deck: {
        ...data.deck,
        attack: data.deck.attack.filter((_, i) => i !== index)
      }
    });
  };

  const updateAttackCard = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      deck: {
        ...data.deck,
        attack: data.deck.attack.map((c, i) => 
          i === index ? { ...c, [field]: value } : c
        )
      }
    });
  };

  // Defense Cards
  const addDefenseCard = () => {
    onChange({
      ...data,
      deck: {
        ...data.deck,
        defense: [
          ...data.deck.defense,
          { name: '', cost: 2, shield: 20 }
        ]
      }
    });
  };

  const removeDefenseCard = (index: number) => {
    onChange({
      ...data,
      deck: {
        ...data.deck,
        defense: data.deck.defense.filter((_, i) => i !== index)
      }
    });
  };

  const updateDefenseCard = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      deck: {
        ...data.deck,
        defense: data.deck.defense.map((c, i) => 
          i === index ? { ...c, [field]: value } : c
        )
      }
    });
  };

  // Special Cards
  const addSpecialCard = () => {
    onChange({
      ...data,
      deck: {
        ...data.deck,
        special: [
          ...data.deck.special,
          { name: '', cost: 4, effect: '' }
        ]
      }
    });
  };

  const removeSpecialCard = (index: number) => {
    onChange({
      ...data,
      deck: {
        ...data.deck,
        special: data.deck.special.filter((_, i) => i !== index)
      }
    });
  };

  const updateSpecialCard = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      deck: {
        ...data.deck,
        special: data.deck.special.map((c, i) => 
          i === index ? { ...c, [field]: value } : c
        )
      }
    });
  };

  return (
    <div className="hackers-deck-form">
      <h3>🎲 Hacker's Deck 시나리오</h3>

      {/* 게임 설정 */}
      <div className="form-section">
        <h4>게임 설정</h4>
        <div className="form-grid-2">
          <div className="form-field">
            <label>시작 손패 크기 *</label>
            <input
              type="number"
              min={3}
              max={10}
              value={data.startingHand}
              onChange={e => onChange({ ...data, startingHand: Number(e.target.value) })}
              required
            />
            <small>게임 시작 시 손에 드는 카드 수</small>
          </div>

          <div className="form-field">
            <label>시작 에너지 *</label>
            <input
              type="number"
              min={1}
              max={10}
              value={data.startingEnergy}
              onChange={e => onChange({ ...data, startingEnergy: Number(e.target.value) })}
              required
            />
            <small>게임 시작 시 보유 에너지</small>
          </div>

          <div className="form-field">
            <label>최대 턴 수 *</label>
            <input
              type="number"
              min={5}
              max={30}
              value={data.maxTurns}
              onChange={e => onChange({ ...data, maxTurns: Number(e.target.value) })}
              required
            />
            <small>게임이 끝나는 턴 수</small>
          </div>

          <div className="form-field">
            <label>승리 조건 *</label>
            <input
              type="text"
              placeholder="예: 상대 HP 0 또는 15턴 후 HP 높은 플레이어"
              value={data.victoryCondition}
              onChange={e => onChange({ ...data, victoryCondition: e.target.value })}
              required
            />
          </div>
        </div>
      </div>

      {/* 공격 카드 */}
      <div className="form-section">
        <div className="section-header">
          <h4>🔴 공격 카드 ({data.deck.attack.length})</h4>
          <button type="button" onClick={addAttackCard} className="btn-add">
            <FaPlus /> 추가
          </button>
        </div>

        {data.deck.attack.map((card, idx) => (
          <div key={idx} className="card-item attack-card">
            <div className="card-header">
              <span>⚔️ {card.name || `Attack Card ${idx + 1}`}</span>
              <button type="button" onClick={() => removeAttackCard(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="card-inputs">
              <div className="input-group">
                <label>카드 이름 *</label>
                <input
                  type="text"
                  placeholder="예: SQL Injection"
                  value={card.name}
                  onChange={e => updateAttackCard(idx, 'name', e.target.value)}
                  required
                />
              </div>

              <div className="input-row-2">
                <div className="input-group">
                  <label>에너지 비용 *</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="3"
                    value={card.cost}
                    onChange={e => updateAttackCard(idx, 'cost', Number(e.target.value))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>데미지 *</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="20"
                    value={card.damage}
                    onChange={e => updateAttackCard(idx, 'damage', Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>특수 효과 (선택)</label>
                <input
                  type="text"
                  placeholder="예: 다음 공격 +10 데미지"
                  value={card.effect || ''}
                  onChange={e => updateAttackCard(idx, 'effect', e.target.value || undefined)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 방어 카드 */}
      <div className="form-section">
        <div className="section-header">
          <h4>🔵 방어 카드 ({data.deck.defense.length})</h4>
          <button type="button" onClick={addDefenseCard} className="btn-add">
            <FaPlus /> 추가
          </button>
        </div>

        {data.deck.defense.map((card, idx) => (
          <div key={idx} className="card-item defense-card">
            <div className="card-header">
              <span>🛡️ {card.name || `Defense Card ${idx + 1}`}</span>
              <button type="button" onClick={() => removeDefenseCard(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="card-inputs">
              <div className="input-group">
                <label>카드 이름 *</label>
                <input
                  type="text"
                  placeholder="예: Firewall"
                  value={card.name}
                  onChange={e => updateDefenseCard(idx, 'name', e.target.value)}
                  required
                />
              </div>

              <div className="input-row-3">
                <div className="input-group">
                  <label>에너지 비용 *</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="2"
                    value={card.cost}
                    onChange={e => updateDefenseCard(idx, 'cost', Number(e.target.value))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>실드 (Shield)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="20"
                    value={card.shield || ''}
                    onChange={e => updateDefenseCard(idx, 'shield', e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>

                <div className="input-group">
                  <label>회복 (Heal)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="15"
                    value={card.heal || ''}
                    onChange={e => updateDefenseCard(idx, 'heal', e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>특수 효과 (선택)</label>
                <input
                  type="text"
                  placeholder="예: 다음 턴 에너지 +1"
                  value={card.effect || ''}
                  onChange={e => updateDefenseCard(idx, 'effect', e.target.value || undefined)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 특수 카드 */}
      <div className="form-section">
        <div className="section-header">
          <h4>⭐ 특수 카드 ({data.deck.special.length})</h4>
          <button type="button" onClick={addSpecialCard} className="btn-add">
            <FaPlus /> 추가
          </button>
        </div>

        {data.deck.special.map((card, idx) => (
          <div key={idx} className="card-item special-card">
            <div className="card-header">
              <span>✨ {card.name || `Special Card ${idx + 1}`}</span>
              <button type="button" onClick={() => removeSpecialCard(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="card-inputs">
              <div className="input-group">
                <label>카드 이름 *</label>
                <input
                  type="text"
                  placeholder="예: Social Engineering"
                  value={card.name}
                  onChange={e => updateSpecialCard(idx, 'name', e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label>에너지 비용 *</label>
                <input
                  type="number"
                  min={0}
                  placeholder="4"
                  value={card.cost}
                  onChange={e => updateSpecialCard(idx, 'cost', Number(e.target.value))}
                  required
                />
              </div>

              <div className="input-group">
                <label>효과 설명 *</label>
                <textarea
                  rows={2}
                  placeholder="예: 상대 손패에서 랜덤 카드 1장 훔치기"
                  value={card.effect}
                  onChange={e => updateSpecialCard(idx, 'effect', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HackersDeckForm;