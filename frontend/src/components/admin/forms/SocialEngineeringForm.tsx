import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/forms/SocialEngineeringForm.scss';

interface AvailableTechnique {
  id: string;
  name: {
    ko: string;
    en: string;
  };
  type: 'PRETEXTING' | 'AUTHORITY' | 'URGENCY' | 'RECIPROCITY' | 'LIKING';
  description: {
    ko: string;
    en: string;
  };
  suspicionImpact: number;
  effectiveness: number;
}

interface SocialEngineeringData {
  scenarioType: 'IT_HELPDESK' | 'FINANCE_SPEARPHISHING' | 'CEO_IMPERSONATION';
  objective: {
    title: {
      ko: string;
      en: string;
    };
    description: {
      ko: string;
      en: string;
    };
    targetInformation: string[];
  };
  aiTarget: {
    name: string;
    role: string;
    department: string;
    personality: {
      helpfulness: number;
      securityAwareness: number;
      authorityRespect: number;
      skepticism: number;
    };
    suspicionThreshold: number;
    knownInfo: string[];
    secretInfo: string[];
  };
  availableTechniques: AvailableTechnique[];
  conversationRules: {
    maxTurns: number;
    turnTimeLimit?: number;
    warningThresholds: number[];
  };
  scoring: {
    objectiveComplete: number;
    turnEfficiency: {
      maxBonus: number;
      optimalTurns: number;
    };
    suspicionManagement: {
      bonus: number;
      threshold: number;
    };
    naturalnessBonus: {
      maxPoints: number;
      evaluationCriteria: string[];
    };
  };
}

interface Props {
  data: SocialEngineeringData;
  onChange: (data: SocialEngineeringData) => void;
}

const SocialEngineeringForm: React.FC<Props> = ({ data, onChange }) => {
  const [isJsonMode, setIsJsonMode] = React.useState(false);
  const [jsonInput, setJsonInput] = React.useState('');
  const [jsonError, setJsonError] = React.useState('');

  const handleJsonImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      onChange(parsed);
      setJsonError('');
      setIsJsonMode(false);
      alert('✅ JSON 데이터가 성공적으로 가져와졌습니다!');
    } catch (err) {
      setJsonError('❌ JSON 형식이 올바르지 않습니다: ' + (err as Error).message);
    }
  };

  const handleJsonExport = () => {
    const json = JSON.stringify(data, null, 2);
    setJsonInput(json);
    setIsJsonMode(true);
  };

  // Techniques
  const addTechnique = () => {
    onChange({
      ...data,
      availableTechniques: [
        ...data.availableTechniques,
        {
          id: `tech_${Date.now()}`,
          name: { ko: '', en: '' },
          type: 'PRETEXTING',
          description: { ko: '', en: '' },
          suspicionImpact: 10,
          effectiveness: 5
        }
      ]
    });
  };

  const removeTechnique = (index: number) => {
    onChange({
      ...data,
      availableTechniques: data.availableTechniques.filter((_, i) => i !== index)
    });
  };

  const updateTechnique = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      availableTechniques: data.availableTechniques.map((t, i) => 
        i === index ? { ...t, [field]: value } : t
      )
    });
  };

  return (
    <div className="social-engineering-form">
      <div className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>💬 Social Engineering Challenge 시나리오</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={() => setIsJsonMode(!isJsonMode)} className="btn-add">
            {isJsonMode ? '📝 폼 모드' : '📋 JSON 모드'}
          </button>
          {isJsonMode && (
            <button type="button" onClick={handleJsonImport} className="btn-add" style={{ background: '#28a745' }}>
              ✅ JSON 가져오기
            </button>
          )}
          {!isJsonMode && (
            <button type="button" onClick={handleJsonExport} className="btn-add" style={{ background: '#007bff' }}>
              📤 JSON 내보내기
            </button>
          )}
        </div>
      </div>

      {isJsonMode ? (
        <div style={{ padding: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 600 }}>
            JSON 데이터 입력
          </label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            style={{
              width: '100%',
              minHeight: '400px',
              fontFamily: 'monospace',
              fontSize: '13px',
              padding: '12px',
              border: '1px solid #444',
              borderRadius: '6px',
              background: '#1a1a1a',
              color: '#e0e0e0'
            }}
            placeholder={`{
  "scenarioType": "IT_HELPDESK",
  "objective": {
    "title": { "ko": "...", "en": "..." },
    "description": { "ko": "...", "en": "..." },
    "targetInformation": [...]
  },
  "aiTarget": {...},
  ...
}`}
          />
          {jsonError && (
            <div style={{ color: '#ff4444', marginTop: '10px', fontSize: '13px' }}>
              {jsonError}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 시나리오 타입 & 목표 */}
          <div className="form-section">
        <h4>🎯 시나리오 설정</h4>
        
        <div className="form-field">
          <label>시나리오 타입 *</label>
          <select
            value={data.scenarioType}
            onChange={e => onChange({ ...data, scenarioType: e.target.value as any })}
            required
          >
            <option value="IT_HELPDESK">💻 IT 헬프데스크 공격 (초급)</option>
            <option value="FINANCE_SPEARPHISHING">💰 재무팀 스피어피싱 (중급)</option>
            <option value="CEO_IMPERSONATION">👔 CEO 사칭 (고급)</option>
          </select>
        </div>

        {/* Objective Title - Bilingual */}
        <div className="form-field" style={{ border: '1px solid #444', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
            목표 제목 (Objective Title) *
          </label>
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>한글</label>
              <input
                type="text"
                placeholder="예: VPN 접속 정보 획득"
                value={data.objective.title.ko}
                onChange={e => onChange({
                  ...data,
                  objective: { ...data.objective, title: { ...data.objective.title, ko: e.target.value } }
                })}
                required
              />
            </div>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>English</label>
              <input
                type="text"
                placeholder="Ex: Obtain VPN Access Information"
                value={data.objective.title.en}
                onChange={e => onChange({
                  ...data,
                  objective: { ...data.objective, title: { ...data.objective.title, en: e.target.value } }
                })}
                required
              />
            </div>
          </div>
        </div>

        {/* Objective Description - Bilingual */}
        <div className="form-field" style={{ border: '1px solid #444', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
            목표 설명 (Objective Description) *
          </label>
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>한글</label>
              <textarea
                rows={2}
                placeholder="예: IT 헬프데스크 직원으로부터 VPN 서버 주소와 접속 방법을 얻어내세요."
                value={data.objective.description.ko}
                onChange={e => onChange({
                  ...data,
                  objective: { ...data.objective, description: { ...data.objective.description, ko: e.target.value } }
                })}
                required
              />
            </div>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>English</label>
              <textarea
                rows={2}
                placeholder="Ex: Obtain VPN server address and access method from IT helpdesk staff."
                value={data.objective.description.en}
                onChange={e => onChange({
                  ...data,
                  objective: { ...data.objective, description: { ...data.objective.description, en: e.target.value } }
                })}
                required
              />
            </div>
          </div>
        </div>

        <div className="form-field">
          <label>획득해야 할 정보 목록 (쉼표로 구분) *</label>
          <input
            type="text"
            placeholder="예: VPN 서버 주소, 기본 계정 정보, 원격 접속 방법"
            value={data.objective.targetInformation.join(', ')}
            onChange={e => onChange({
              ...data,
              objective: {
                ...data.objective,
                targetInformation: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              }
            })}
            required
          />
          <small>플레이어가 획득해야 하는 구체적인 정보들</small>
        </div>
      </div>

          {/* AI 타겟 설정 */}
          <div className="form-section">
        <h4>🤖 AI 타겟 (대화 상대)</h4>

        <div className="form-grid-3">
          <div className="form-field">
            <label>이름 *</label>
            <input
              type="text"
              placeholder="예: 김민수"
              value={data.aiTarget.name}
              onChange={e => onChange({
                ...data,
                aiTarget: { ...data.aiTarget, name: e.target.value }
              })}
              required
            />
          </div>

          <div className="form-field">
            <label>직책 *</label>
            <input
              type="text"
              placeholder="예: IT 헬프데스크 매니저"
              value={data.aiTarget.role}
              onChange={e => onChange({
                ...data,
                aiTarget: { ...data.aiTarget, role: e.target.value }
              })}
              required
            />
          </div>

          <div className="form-field">
            <label>부서 *</label>
            <input
              type="text"
              placeholder="예: IT 운영팀"
              value={data.aiTarget.department}
              onChange={e => onChange({
                ...data,
                aiTarget: { ...data.aiTarget, department: e.target.value }
              })}
              required
            />
          </div>
        </div>

        <div className="form-subsection">
          <h5>성격 설정 (1-10)</h5>
          <div className="form-grid-4">
            <div className="form-field">
              <label>친절도 *</label>
              <input
                type="number"
                min={1}
                max={10}
                value={data.aiTarget.personality.helpfulness}
                onChange={e => onChange({
                  ...data,
                  aiTarget: {
                    ...data.aiTarget,
                    personality: {
                      ...data.aiTarget.personality,
                      helpfulness: Number(e.target.value)
                    }
                  }
                })}
                required
              />
              <small>높을수록 협조적</small>
            </div>

            <div className="form-field">
              <label>보안 인식 *</label>
              <input
                type="number"
                min={1}
                max={10}
                value={data.aiTarget.personality.securityAwareness}
                onChange={e => onChange({
                  ...data,
                  aiTarget: {
                    ...data.aiTarget,
                    personality: {
                      ...data.aiTarget.personality,
                      securityAwareness: Number(e.target.value)
                    }
                  }
                })}
                required
              />
              <small>높을수록 경계심 많음</small>
            </div>

            <div className="form-field">
              <label>권위 존중 *</label>
              <input
                type="number"
                min={1}
                max={10}
                value={data.aiTarget.personality.authorityRespect}
                onChange={e => onChange({
                  ...data,
                  aiTarget: {
                    ...data.aiTarget,
                    personality: {
                      ...data.aiTarget.personality,
                      authorityRespect: Number(e.target.value)
                    }
                  }
                })}
                required
              />
              <small>높을수록 상급자에 약함</small>
            </div>

            <div className="form-field">
              <label>회의감 *</label>
              <input
                type="number"
                min={1}
                max={10}
                value={data.aiTarget.personality.skepticism}
                onChange={e => onChange({
                  ...data,
                  aiTarget: {
                    ...data.aiTarget,
                    personality: {
                      ...data.aiTarget.personality,
                      skepticism: Number(e.target.value)
                    }
                  }
                })}
                required
              />
              <small>높을수록 의심 많음</small>
            </div>
          </div>
        </div>

        <div className="form-field">
          <label>의심 한계치 (%) *</label>
          <input
            type="number"
            min={10}
            max={100}
            value={data.aiTarget.suspicionThreshold}
            onChange={e => onChange({
              ...data,
              aiTarget: { ...data.aiTarget, suspicionThreshold: Number(e.target.value) }
            })}
            required
          />
          <small>Easy: 70%, Medium: 50%, Hard: 30% - 이 수치를 넘으면 차단됨</small>
        </div>

        <div className="form-field">
          <label>AI가 알고 있는 정보 (쉼표로 구분) *</label>
          <input
            type="text"
            placeholder="예: VPN 서버는 vpn.company.com, 기본 포트는 1194"
            value={data.aiTarget.knownInfo.join(', ')}
            onChange={e => onChange({
              ...data,
              aiTarget: {
                ...data.aiTarget,
                knownInfo: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              }
            })}
            required
          />
          <small>AI가 공개할 수 있는 정보</small>
        </div>

        <div className="form-field">
          <label>비밀 정보 (절대 공개 금지, 쉼표로 구분) *</label>
          <input
            type="text"
            placeholder="예: 관리자 계정 비밀번호, VPN 마스터 키"
            value={data.aiTarget.secretInfo.join(', ')}
            onChange={e => onChange({
              ...data,
              aiTarget: {
                ...data.aiTarget,
                secretInfo: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              }
            })}
            required
          />
          <small>AI가 절대 공개하면 안 되는 정보</small>
        </div>
      </div>

      {/* 사회공학 테크닉 */}
      <div className="form-section">
        <div className="section-header">
          <h4>🎭 사용 가능한 테크닉 ({data.availableTechniques.length})</h4>
          <button type="button" onClick={addTechnique} className="btn-add">
            <FaPlus /> 추가
          </button>
        </div>

        {data.availableTechniques.map((tech, idx) => (
          <div key={idx} className="technique-card">
            <div className="technique-header">
              <span>🎯 Technique {idx + 1}: {typeof tech.name === 'object' ? (tech.name.ko || tech.name.en || '(이름 없음)') : (tech.name || '(이름 없음)')}</span>
              <button type="button" onClick={() => removeTechnique(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="technique-inputs">
              {/* Technique Name - Bilingual */}
              <div className="input-group" style={{ border: '1px solid #555', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  테크닉 이름 (Technique Name) *
                </label>
                <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '10px', opacity: 0.7 }}>한글</label>
                    <input
                      type="text"
                      placeholder="예: 신입 사원 위장"
                      value={tech.name?.ko || ''}
                      onChange={e => updateTechnique(idx, 'name', { ...tech.name, ko: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '10px', opacity: 0.7 }}>English</label>
                    <input
                      type="text"
                      placeholder="Ex: New Employee Disguise"
                      value={tech.name?.en || ''}
                      onChange={e => updateTechnique(idx, 'name', { ...tech.name, en: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="input-row-2">
                <div className="input-group">
                  <label>타입 *</label>
                  <select
                    value={tech.type}
                    onChange={e => updateTechnique(idx, 'type', e.target.value)}
                    required
                  >
                    <option value="PRETEXTING">🎭 Pretexting (가짜 신분)</option>
                    <option value="AUTHORITY">👔 Authority (권위 이용)</option>
                    <option value="URGENCY">⏰ Urgency (긴급성 조성)</option>
                    <option value="RECIPROCITY">🤝 Reciprocity (호의 이용)</option>
                    <option value="LIKING">😊 Liking (동질감 형성)</option>
                  </select>
                </div>
              </div>

              {/* Technique Description - Bilingual */}
              <div className="input-group" style={{ border: '1px solid #555', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  설명 (Description) *
                </label>
                <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '10px', opacity: 0.7 }}>한글</label>
                    <input
                      type="text"
                      placeholder="예: 신입 직원인 척하며 도움을 요청"
                      value={tech.description?.ko || ''}
                      onChange={e => updateTechnique(idx, 'description', { ...tech.description, ko: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '10px', opacity: 0.7 }}>English</label>
                    <input
                      type="text"
                      placeholder="Ex: Pretend to be a new employee and request help"
                      value={tech.description?.en || ''}
                      onChange={e => updateTechnique(idx, 'description', { ...tech.description, en: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="input-row-2">
                <div className="input-group">
                  <label>의심도 증가량 (%) *</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={tech.suspicionImpact}
                    onChange={e => updateTechnique(idx, 'suspicionImpact', Number(e.target.value))}
                    required
                  />
                  <small>낮을수록 안전한 테크닉</small>
                </div>

                <div className="input-group">
                  <label>효과도 (1-10) *</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={tech.effectiveness}
                    onChange={e => updateTechnique(idx, 'effectiveness', Number(e.target.value))}
                    required
                  />
                  <small>높을수록 정보 획득 가능성 증가</small>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 대화 규칙 */}
      <div className="form-section">
        <h4>💬 대화 규칙</h4>
        <div className="form-grid-3">
          <div className="form-field">
            <label>최대 턴 수 *</label>
            <input
              type="number"
              min={5}
              max={50}
              value={data.conversationRules.maxTurns}
              onChange={e => onChange({
                ...data,
                conversationRules: {
                  ...data.conversationRules,
                  maxTurns: Number(e.target.value)
                }
              })}
              required
            />
            <small>대화 가능한 최대 횟수</small>
          </div>

          <div className="form-field">
            <label>턴 제한 시간 (초, 선택)</label>
            <input
              type="number"
              min={0}
              value={data.conversationRules.turnTimeLimit || ''}
              onChange={e => onChange({
                ...data,
                conversationRules: {
                  ...data.conversationRules,
                  turnTimeLimit: e.target.value ? Number(e.target.value) : undefined
                }
              })}
            />
            <small>0 = 무제한</small>
          </div>
        </div>

        <div className="form-field">
          <label>의심도 경고 레벨 (쉼표로 구분) *</label>
          <input
            type="text"
            placeholder="예: 30, 60, 90"
            value={data.conversationRules.warningThresholds.join(', ')}
            onChange={e => onChange({
              ...data,
              conversationRules: {
                ...data.conversationRules,
                warningThresholds: e.target.value.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n))
              }
            })}
            required
          />
          <small>의심도가 이 수치에 도달하면 경고 표시</small>
        </div>
      </div>

      {/* 점수 시스템 */}
      <div className="form-section">
        <h4>🏆 점수 시스템</h4>
        
        <div className="form-field">
          <label>목표 달성 점수 *</label>
          <input
            type="number"
            min={0}
            value={data.scoring.objectiveComplete}
            onChange={e => onChange({
              ...data,
              scoring: { ...data.scoring, objectiveComplete: Number(e.target.value) }
            })}
            required
          />
        </div>

        <div className="form-subsection">
          <h5>턴 효율성 보너스</h5>
          <div className="form-grid-2">
            <div className="form-field">
              <label>최대 보너스 *</label>
              <input
                type="number"
                min={0}
                value={data.scoring.turnEfficiency.maxBonus}
                onChange={e => onChange({
                  ...data,
                  scoring: {
                    ...data.scoring,
                    turnEfficiency: {
                      ...data.scoring.turnEfficiency,
                      maxBonus: Number(e.target.value)
                    }
                  }
                })}
                required
              />
            </div>

            <div className="form-field">
              <label>최적 턴 수 *</label>
              <input
                type="number"
                min={1}
                value={data.scoring.turnEfficiency.optimalTurns}
                onChange={e => onChange({
                  ...data,
                  scoring: {
                    ...data.scoring,
                    turnEfficiency: {
                      ...data.scoring.turnEfficiency,
                      optimalTurns: Number(e.target.value)
                    }
                  }
                })}
                required
              />
              <small>이 턴 수 이하로 완료하면 최대 보너스</small>
            </div>
          </div>
        </div>

        <div className="form-subsection">
          <h5>의심도 관리 보너스</h5>
          <div className="form-grid-2">
            <div className="form-field">
              <label>보너스 점수 *</label>
              <input
                type="number"
                min={0}
                value={data.scoring.suspicionManagement.bonus}
                onChange={e => onChange({
                  ...data,
                  scoring: {
                    ...data.scoring,
                    suspicionManagement: {
                      ...data.scoring.suspicionManagement,
                      bonus: Number(e.target.value)
                    }
                  }
                })}
                required
              />
            </div>

            <div className="form-field">
              <label>의심도 한계치 (%) *</label>
              <input
                type="number"
                min={0}
                max={100}
                value={data.scoring.suspicionManagement.threshold}
                onChange={e => onChange({
                  ...data,
                  scoring: {
                    ...data.scoring,
                    suspicionManagement: {
                      ...data.scoring.suspicionManagement,
                      threshold: Number(e.target.value)
                    }
                  }
                })}
                required
              />
              <small>이 수치 이하 유지 시 보너스</small>
            </div>
          </div>
        </div>

        <div className="form-subsection">
          <h5>자연스러움 보너스</h5>
          <div className="form-field">
            <label>최대 점수 *</label>
            <input
              type="number"
              min={0}
              value={data.scoring.naturalnessBonus.maxPoints}
              onChange={e => onChange({
                ...data,
                scoring: {
                  ...data.scoring,
                  naturalnessBonus: {
                    ...data.scoring.naturalnessBonus,
                    maxPoints: Number(e.target.value)
                  }
                }
              })}
              required
            />
          </div>

          <div className="form-field">
            <label>평가 기준 (쉼표로 구분) *</label>
            <input
              type="text"
              placeholder="예: 대화 흐름, 자연스러운 질문, 상황에 맞는 반응"
              value={data.scoring.naturalnessBonus.evaluationCriteria.join(', ')}
              onChange={e => onChange({
                ...data,
                scoring: {
                  ...data.scoring,
                  naturalnessBonus: {
                    ...data.scoring.naturalnessBonus,
                    evaluationCriteria: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  }
                }
              })}
              required
            />
            <small>AI가 평가할 기준들</small>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default SocialEngineeringForm;