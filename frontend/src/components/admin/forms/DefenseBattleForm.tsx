import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/DefenseBattleForm.scss';

interface DefenseAction {
  name: string;
  type: 'ATTACK' | 'DEFENSE';
  damage?: number;
  heal?: number;
  cost: number;
}

interface DefenseBattleData {
  duration: number;
  teams: string[];
  actions: DefenseAction[];
  startingHealth: number;
}

interface Props {
  data: DefenseBattleData;
  onChange: (data: DefenseBattleData) => void;
}

const DefenseBattleForm: React.FC<Props> = ({ data, onChange }) => {
  
  const addAction = () => {
    onChange({
      ...data,
      actions: [
        ...data.actions,
        { name: '', type: 'ATTACK', damage: 0, cost: 0 }
      ]
    });
  };

  const removeAction = (index: number) => {
    onChange({
      ...data,
      actions: data.actions.filter((_, i) => i !== index)
    });
  };

  const updateAction = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      actions: data.actions.map((a, i) => 
        i === index ? { ...a, [field]: value } : a
      )
    });
  };

  return (
    <div className="defense-battle-form">
      <h3>Defense Battle Settings</h3>

      <div className="form-grid-2">
        <div className="form-field">
          <label>Duration (seconds)</label>
          <input
            type="number"
            min={300}
            max={1800}
            value={data.duration}
            onChange={e => onChange({ ...data, duration: Number(e.target.value) })}
            required
          />
        </div>

        <div className="form-field">
          <label>Starting Health</label>
          <input
            type="number"
            min={50}
            max={200}
            value={data.startingHealth}
            onChange={e => onChange({ ...data, startingHealth: Number(e.target.value) })}
            required
          />
        </div>
      </div>

      {/* Actions */}
      <div>
        <div className="section-header">
          <label>Actions ({data.actions.length})</label>
          <button type="button" onClick={addAction}>
            <FaPlus /> Add Action
          </button>
        </div>

        {data.actions.map((action, idx) => (
          <div key={idx} className="action-card">
            <div className="action-header">
              <span>Action {idx + 1}</span>
              <button type="button" onClick={() => removeAction(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="action-inputs">
              <input
                type="text"
                placeholder="Action name"
                value={action.name}
                onChange={e => updateAction(idx, 'name', e.target.value)}
                required
              />
              
              <select
                value={action.type}
                onChange={e => updateAction(idx, 'type', e.target.value as 'ATTACK' | 'DEFENSE')}
              >
                <option value="ATTACK">Attack</option>
                <option value="DEFENSE">Defense</option>
              </select>

              <input
                type="number"
                placeholder={action.type === 'ATTACK' ? 'Damage' : 'Heal'}
                min={0}
                value={action.type === 'ATTACK' ? (action.damage || 0) : (action.heal || 0)}
                onChange={e => {
                  const val = Number(e.target.value);
                  if (action.type === 'ATTACK') {
                    updateAction(idx, 'damage', val);
                  } else {
                    updateAction(idx, 'heal', val);
                  }
                }}
              />

              <input
                type="number"
                placeholder="Cost"
                min={0}
                value={action.cost}
                onChange={e => updateAction(idx, 'cost', Number(e.target.value))}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DefenseBattleForm;