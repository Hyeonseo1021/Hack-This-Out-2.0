import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/forms/DefenseBattleForm.scss';

interface AttackAction {
  name: string;
  damage: number;
  cost: number;
  cooldown: number;
  effect?: string;
}

interface DefenseAction {
  name: string;
  heal?: number;
  shield?: number;
  cost: number;
  cooldown: number;
  effect?: string;
}

interface DefenseBattleData {
  serverHealth: number;
  attackActions: AttackAction[];
  defenseActions: DefenseAction[];
  victoryConditions: {
    attackTeam: string;
    defenseTeam: string;
  };
}

interface Props {
  data: DefenseBattleData;
  onChange: (data: DefenseBattleData) => void;
}

const DefenseBattleForm: React.FC<Props> = ({ data, onChange }) => {
  
  // Attack Actions
  const addAttackAction = () => {
    onChange({
      ...data,
      attackActions: [
        ...data.attackActions,
        { name: '', damage: 0, cost: 0, cooldown: 5 }
      ]
    });
  };

  const removeAttackAction = (index: number) => {
    onChange({
      ...data,
      attackActions: data.attackActions.filter((_, i) => i !== index)
    });
  };

  const updateAttackAction = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      attackActions: data.attackActions.map((a, i) => 
        i === index ? { ...a, [field]: value } : a
      )
    });
  };

  // Defense Actions
  const addDefenseAction = () => {
    onChange({
      ...data,
      defenseActions: [
        ...data.defenseActions,
        { name: '', cost: 0, cooldown: 5 }
      ]
    });
  };

  const removeDefenseAction = (index: number) => {
    onChange({
      ...data,
      defenseActions: data.defenseActions.filter((_, i) => i !== index)
    });
  };

  const updateDefenseAction = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      defenseActions: data.defenseActions.map((a, i) => 
        i === index ? { ...a, [field]: value } : a
      )
    });
  };

  return (
    <div className="defense-battle-form">
      <h3>⚔️ Cyber Defense Battle 시나리오</h3>

      {/* 기본 설정 */}
      <div className="form-section">
        <h4>기본 설정</h4>
        <div className="form-grid-2">
          <div className="form-field">
            <label>서버 초기 HP *</label>
            <input
              type="number"
              min={50}
              max={500}
              value={data.serverHealth}
              onChange={e => onChange({ ...data, serverHealth: Number(e.target.value) })}
              required
            />
            <small>서버의 시작 체력 (공격팀 목표: 0으로 만들기)</small>
          </div>
        </div>
      </div>

      {/* 승리 조건 */}
      <div className="form-section">
        <h4>승리 조건</h4>
        <div className="form-grid-2">
          <div className="form-field">
            <label>공격팀 승리 조건 *</label>
            <input
              type="text"
              placeholder="예: 서버 HP를 0으로 만들기"
              value={data.victoryConditions.attackTeam}
              onChange={e => onChange({ 
                ...data, 
                victoryConditions: { 
                  ...data.victoryConditions, 
                  attackTeam: e.target.value 
                }
              })}
              required
            />
          </div>

          <div className="form-field">
            <label>방어팀 승리 조건 *</label>
            <input
              type="text"
              placeholder="예: 15분 동안 서버 방어"
              value={data.victoryConditions.defenseTeam}
              onChange={e => onChange({ 
                ...data, 
                victoryConditions: { 
                  ...data.victoryConditions, 
                  defenseTeam: e.target.value 
                }
              })}
              required
            />
          </div>
        </div>
      </div>

      {/* 공격 액션 */}
      <div className="form-section">
        <div className="section-header">
          <h4> 공격 액션 ({data.attackActions.length})</h4>
          <button type="button" onClick={addAttackAction} className="btn-add">
            <FaPlus /> 추가
          </button>
        </div>

        {data.attackActions.map((action, idx) => (
          <div key={idx} className="action-card attack-card">
            <div className="action-header">
              <span>🔴 Attack {idx + 1}: {action.name || '(이름 없음)'}</span>
              <button type="button" onClick={() => removeAttackAction(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="action-inputs">
              <div className="input-group">
                <label>액션 이름 *</label>
                <input
                  type="text"
                  placeholder="예: SQL Injection"
                  value={action.name}
                  onChange={e => updateAttackAction(idx, 'name', e.target.value)}
                  required
                />
              </div>

              <div className="input-row-3">
                <div className="input-group">
                  <label>데미지 *</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="20"
                    value={action.damage}
                    onChange={e => updateAttackAction(idx, 'damage', Number(e.target.value))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>에너지 비용 *</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="10"
                    value={action.cost}
                    onChange={e => updateAttackAction(idx, 'cost', Number(e.target.value))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>쿨다운 (초) *</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="5"
                    value={action.cooldown}
                    onChange={e => updateAttackAction(idx, 'cooldown', Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>특수 효과 (선택)</label>
                <input
                  type="text"
                  placeholder="예: slow_services, disable_defense"
                  value={action.effect || ''}
                  onChange={e => updateAttackAction(idx, 'effect', e.target.value || undefined)}
                />
                <small>특수 효과 ID (서버 측에서 처리)</small>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 방어 액션 */}
      <div className="form-section">
        <div className="section-header">
          <h4> 방어 액션 ({data.defenseActions.length})</h4>
          <button type="button" onClick={addDefenseAction} className="btn-add">
            <FaPlus /> 추가
          </button>
        </div>

        {data.defenseActions.map((action, idx) => (
          <div key={idx} className="action-card defense-card">
            <div className="action-header">
              <span>🔵 Defense {idx + 1}: {action.name || '(이름 없음)'}</span>
              <button type="button" onClick={() => removeDefenseAction(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="action-inputs">
              <div className="input-group">
                <label>액션 이름 *</label>
                <input
                  type="text"
                  placeholder="예: Patch Vulnerability"
                  value={action.name}
                  onChange={e => updateDefenseAction(idx, 'name', e.target.value)}
                  required
                />
              </div>

              <div className="input-row-3">
                <div className="input-group">
                  <label>회복량 (Heal)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="15"
                    value={action.heal || ''}
                    onChange={e => updateDefenseAction(idx, 'heal', e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>

                <div className="input-group">
                  <label>실드 (Shield)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="20"
                    value={action.shield || ''}
                    onChange={e => updateDefenseAction(idx, 'shield', e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>

                <div className="input-group">
                  <label>에너지 비용 *</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="10"
                    value={action.cost}
                    onChange={e => updateDefenseAction(idx, 'cost', Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="input-row-2">
                <div className="input-group">
                  <label>쿨다운 (초) *</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="5"
                    value={action.cooldown}
                    onChange={e => updateDefenseAction(idx, 'cooldown', Number(e.target.value))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>특수 효과 (선택)</label>
                  <input
                    type="text"
                    placeholder="예: counter_attack, block_next"
                    value={action.effect || ''}
                    onChange={e => updateDefenseAction(idx, 'effect', e.target.value || undefined)}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DefenseBattleForm;