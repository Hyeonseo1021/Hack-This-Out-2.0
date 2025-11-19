import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/forms/KingOfTheHillForm.scss';

interface AttackAction {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  successRate: number;
  effect: 'capture' | 'points';
  points?: number;
  cooldown: number;
}

interface DefenseAction {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  effect: 'defenseLevel' | 'block';
  defenseBonus?: number;
  blockChance?: number;
  cooldown: number;
}

interface KingOfTheHillData {
  serverInfo: {
    name: string;
    description: string;
    os: string;
    initialVulnerabilities: string[];
  };
  attackActions: AttackAction[];
  defenseActions: DefenseAction[];
  scoring: {
    pointsPerSecond: number;
    firstCaptureBonus: number;
    fiveSecondBonus: number;
    oneMinuteBonus: number;
    captureBonus: number;
  };
  energySettings: {
    initial: number;
    regenRate: number;
    maxEnergy: number;
  };
}

interface Props {
  data: KingOfTheHillData;
  onChange: (data: KingOfTheHillData) => void;
}

const KingOfTheHillForm: React.FC<Props> = ({ data, onChange }) => {
  
  // Attack Actions
  const addAttackAction = () => {
    onChange({
      ...data,
      attackActions: [
        ...data.attackActions,
        { 
          id: `attack_${Date.now()}`,
          name: '', 
          description: '',
          energyCost: 15, 
          successRate: 50, 
          effect: 'capture',
          cooldown: 10 
        }
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
        { 
          id: `defense_${Date.now()}`,
          name: '', 
          description: '',
          energyCost: 10, 
          effect: 'defenseLevel',
          cooldown: 10 
        }
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
    <div className="king-of-the-hill-form">
      <h3>👑 King of the Hill 시나리오</h3>

      {/* 서버 정보 */}
      <div className="form-section">
        <h4>🖥️ 서버 정보</h4>
        <div className="form-grid-2">
          <div className="form-field">
            <label>서버 이름 *</label>
            <input
              type="text"
              placeholder="예: Production Web Server"
              value={data.serverInfo.name}
              onChange={e => onChange({ 
                ...data, 
                serverInfo: { ...data.serverInfo, name: e.target.value }
              })}
              required
            />
          </div>

          <div className="form-field">
            <label>운영체제 *</label>
            <input
              type="text"
              placeholder="예: Ubuntu 20.04"
              value={data.serverInfo.os}
              onChange={e => onChange({ 
                ...data, 
                serverInfo: { ...data.serverInfo, os: e.target.value }
              })}
              required
            />
          </div>
        </div>

        <div className="form-field">
          <label>서버 설명 *</label>
          <textarea
            rows={2}
            placeholder="예: 회사의 핵심 웹 서버. 고객 데이터베이스와 연결되어 있음."
            value={data.serverInfo.description}
            onChange={e => onChange({ 
              ...data, 
              serverInfo: { ...data.serverInfo, description: e.target.value }
            })}
            required
          />
        </div>

        <div className="form-field">
          <label>초기 취약점 (쉼표로 구분) *</label>
          <input
            type="text"
            placeholder="예: Outdated SSH, Weak Firewall, Unpatched RCE"
            value={data.serverInfo.initialVulnerabilities.join(', ')}
            onChange={e => onChange({ 
              ...data, 
              serverInfo: { 
                ...data.serverInfo, 
                initialVulnerabilities: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              }
            })}
            required
          />
          <small>플레이어가 공략할 수 있는 취약점 목록</small>
        </div>
      </div>

      {/* 에너지 설정 */}
      <div className="form-section">
        <h4>⚡ 에너지 설정</h4>
        <div className="form-grid-3">
          <div className="form-field">
            <label>초기 에너지 *</label>
            <input
              type="number"
              min={50}
              max={200}
              value={data.energySettings.initial}
              onChange={e => onChange({ 
                ...data, 
                energySettings: { ...data.energySettings, initial: Number(e.target.value) }
              })}
              required
            />
          </div>

          <div className="form-field">
            <label>초당 회복량 *</label>
            <input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={data.energySettings.regenRate}
              onChange={e => onChange({ 
                ...data, 
                energySettings: { ...data.energySettings, regenRate: Number(e.target.value) }
              })}
              required
            />
          </div>

          <div className="form-field">
            <label>최대 에너지 *</label>
            <input
              type="number"
              min={50}
              max={200}
              value={data.energySettings.maxEnergy}
              onChange={e => onChange({ 
                ...data, 
                energySettings: { ...data.energySettings, maxEnergy: Number(e.target.value) }
              })}
              required
            />
          </div>
        </div>
      </div>

      {/* 점수 설정 */}
      <div className="form-section">
        <h4>🏆 점수 시스템</h4>
        <div className="form-grid-3">
          <div className="form-field">
            <label>왕 유지 시 초당 점수 *</label>
            <input
              type="number"
              min={1}
              max={10}
              value={data.scoring.pointsPerSecond}
              onChange={e => onChange({ 
                ...data, 
                scoring: { ...data.scoring, pointsPerSecond: Number(e.target.value) }
              })}
              required
            />
          </div>

          <div className="form-field">
            <label>첫 점령 보너스 *</label>
            <input
              type="number"
              min={0}
              value={data.scoring.firstCaptureBonus}
              onChange={e => onChange({ 
                ...data, 
                scoring: { ...data.scoring, firstCaptureBonus: Number(e.target.value) }
              })}
              required
            />
          </div>

          <div className="form-field">
            <label>5초 유지 보너스 *</label>
            <input
              type="number"
              min={0}
              value={data.scoring.fiveSecondBonus}
              onChange={e => onChange({ 
                ...data, 
                scoring: { ...data.scoring, fiveSecondBonus: Number(e.target.value) }
              })}
              required
            />
          </div>

          <div className="form-field">
            <label>1분 유지 보너스 *</label>
            <input
              type="number"
              min={0}
              value={data.scoring.oneMinuteBonus}
              onChange={e => onChange({ 
                ...data, 
                scoring: { ...data.scoring, oneMinuteBonus: Number(e.target.value) }
              })}
              required
            />
          </div>

          <div className="form-field">
            <label>왕 탈환 보너스 *</label>
            <input
              type="number"
              min={0}
              value={data.scoring.captureBonus}
              onChange={e => onChange({ 
                ...data, 
                scoring: { ...data.scoring, captureBonus: Number(e.target.value) }
              })}
              required
            />
          </div>
        </div>
      </div>

      {/* 공격 액션 */}
      <div className="form-section">
        <div className="section-header">
          <h4>⚔️ 공격 액션 ({data.attackActions.length})</h4>
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
                  placeholder="예: Brute Force SSH"
                  value={action.name}
                  onChange={e => updateAttackAction(idx, 'name', e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label>설명 *</label>
                <input
                  type="text"
                  placeholder="예: SSH 포트로 무차별 대입 공격 시도"
                  value={action.description}
                  onChange={e => updateAttackAction(idx, 'description', e.target.value)}
                  required
                />
              </div>

              <div className="input-row-3">
                <div className="input-group">
                  <label>에너지 비용 *</label>
                  <input
                    type="number"
                    min={0}
                    value={action.energyCost}
                    onChange={e => updateAttackAction(idx, 'energyCost', Number(e.target.value))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>성공률 (%) *</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={action.successRate}
                    onChange={e => updateAttackAction(idx, 'successRate', Number(e.target.value))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>쿨다운 (초) *</label>
                  <input
                    type="number"
                    min={0}
                    value={action.cooldown}
                    onChange={e => updateAttackAction(idx, 'cooldown', Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="input-row-2">
                <div className="input-group">
                  <label>효과 타입 *</label>
                  <select
                    value={action.effect}
                    onChange={e => updateAttackAction(idx, 'effect', e.target.value as 'capture' | 'points')}
                    required
                  >
                    <option value="capture">👑 왕좌 점령</option>
                    <option value="points">💯 점수 획득</option>
                  </select>
                </div>

                {action.effect === 'points' && (
                  <div className="input-group">
                    <label>획득 점수 *</label>
                    <input
                      type="number"
                      min={0}
                      value={action.points || 0}
                      onChange={e => updateAttackAction(idx, 'points', Number(e.target.value))}
                      required
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 방어 액션 */}
      <div className="form-section">
        <div className="section-header">
          <h4>🛡️ 방어 액션 ({data.defenseActions.length})</h4>
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

              <div className="input-group">
                <label>설명 *</label>
                <input
                  type="text"
                  placeholder="예: 취약점을 패치하여 방어 레벨 증가"
                  value={action.description}
                  onChange={e => updateDefenseAction(idx, 'description', e.target.value)}
                  required
                />
              </div>

              <div className="input-row-3">
                <div className="input-group">
                  <label>에너지 비용 *</label>
                  <input
                    type="number"
                    min={0}
                    value={action.energyCost}
                    onChange={e => updateDefenseAction(idx, 'energyCost', Number(e.target.value))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>효과 타입 *</label>
                  <select
                    value={action.effect}
                    onChange={e => updateDefenseAction(idx, 'effect', e.target.value as 'defenseLevel' | 'block')}
                    required
                  >
                    <option value="defenseLevel">📈 방어 레벨 증가</option>
                    <option value="block">🚫 공격 차단</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>쿨다운 (초) *</label>
                  <input
                    type="number"
                    min={0}
                    value={action.cooldown}
                    onChange={e => updateDefenseAction(idx, 'cooldown', Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              {action.effect === 'defenseLevel' && (
                <div className="input-group">
                  <label>방어 레벨 증가량 *</label>
                  <input
                    type="number"
                    min={0}
                    value={action.defenseBonus || 0}
                    onChange={e => updateDefenseAction(idx, 'defenseBonus', Number(e.target.value))}
                    required
                  />
                  <small>공격 성공률을 감소시킵니다</small>
                </div>
              )}

              {action.effect === 'block' && (
                <div className="input-group">
                  <label>차단 확률 증가 (%) *</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={action.blockChance || 0}
                    onChange={e => updateDefenseAction(idx, 'blockChance', Number(e.target.value))}
                    required
                  />
                  <small>다음 공격을 차단할 확률이 증가합니다</small>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KingOfTheHillForm;