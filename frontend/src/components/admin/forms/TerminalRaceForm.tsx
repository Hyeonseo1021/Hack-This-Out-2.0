import React from 'react';
import { FaPlus, FaMinus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/forms/TerminalRaceForm.scss';

interface Command {
  command: string;
  args?: string[];
  response: {
    ko: string;
    en: string;
  };
  progressDelta?: number;
  advanceStage?: boolean;
  flagFound?: boolean;
}

interface Stage {
  stage: number;
  prompt: {
    ko: string;
    en: string;
  };
  commands: Command[];
  defaultResponse: {
    ko: string;
    en: string;
  };
}

interface TerminalRaceData {
  totalStages: number;
  stages: Stage[];
}

interface Props {
  data: TerminalRaceData;
  onChange: (data: TerminalRaceData) => void;
}

const TerminalRaceForm: React.FC<Props> = ({ data, onChange }) => {
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

  const addStage = () => {
    onChange({
      ...data,
      totalStages: data.stages.length + 1,
      stages: [
        ...data.stages,
        {
          stage: data.stages.length + 1,
          prompt: { ko: '', en: '' },
          commands: [],
          defaultResponse: { ko: '유효하지 않은 명령어입니다.', en: 'Invalid command.' }
        }
      ]
    });
  };

  const removeStage = (index: number) => {
    if (data.stages.length <= 1) return;
    onChange({
      ...data,
      totalStages: data.stages.length - 1,
      stages: data.stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, stage: i + 1 }))
    });
  };

  const updateStage = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      stages: data.stages.map((s, i) => i === index ? { ...s, [field]: value } : s)
    });
  };

  const addCommand = (stageIndex: number) => {
    onChange({
      ...data,
      stages: data.stages.map((s, i) =>
        i === stageIndex ? {
          ...s,
          commands: [
            ...s.commands,
            {
              command: '',
              response: { ko: '', en: '' },
              progressDelta: 0,
              advanceStage: false,
              flagFound: false
            }
          ]
        } : s
      )
    });
  };

  const removeCommand = (stageIndex: number, commandIndex: number) => {
    onChange({
      ...data,
      stages: data.stages.map((s, i) => 
        i === stageIndex ? {
          ...s,
          commands: s.commands.filter((_, ci) => ci !== commandIndex)
        } : s
      )
    });
  };

  const updateCommand = (stageIndex: number, commandIndex: number, field: string, value: any) => {
    onChange({
      ...data,
      stages: data.stages.map((s, i) => 
        i === stageIndex ? {
          ...s,
          commands: s.commands.map((c, ci) => 
            ci === commandIndex ? { ...c, [field]: value } : c
          )
        } : s
      )
    });
  };

  return (
    <div className="terminal-race-form scenario-form">
      <div className="form-header">
        <h3>Terminal Hacking Race 시나리오</h3>
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
            <>
              <button type="button" onClick={handleJsonExport} className="btn-add" style={{ background: '#007bff' }}>
                📤 JSON 내보내기
              </button>
              <button type="button" onClick={addStage} className="btn-add">
                <FaPlus /> 스테이지 추가
              </button>
            </>
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
  "totalStages": 3,
  "stages": [
    {
      "stage": 1,
      "prompt": {
        "ko": "환영합니다...",
        "en": "Welcome..."
      },
      "commands": [...],
      "defaultResponse": {
        "ko": "유효하지 않은 명령어입니다.",
        "en": "Invalid command."
      }
    }
  ]
}`}
          />
          {jsonError && (
            <div style={{ color: '#ff4444', marginTop: '10px', fontSize: '13px' }}>
              {jsonError}
            </div>
          )}
        </div>
      ) : null}

      {!isJsonMode && (
        <div className="stages-list">
        {data.stages.map((stage, sIdx) => (
          <div key={sIdx} className="stage-card">
            <div className="stage-header">
              <strong>Stage {sIdx + 1}</strong>
              {data.stages.length > 1 && (
                <button type="button" onClick={() => removeStage(sIdx)} className="btn-remove">
                  <FaMinus /> 삭제
                </button>
              )}
            </div>

            <div className="stage-content">
              {/* Prompt - Bilingual */}
              <div className="form-field" style={{ border: '1px solid #444', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                  프롬프트 메시지 (Prompt Message) *
                </label>
                <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '11px', opacity: 0.7 }}>한글</label>
                    <input
                      type="text"
                      placeholder="환영합니다. 타겟 스캔부터 시작하세요."
                      value={stage.prompt.ko}
                      onChange={e => updateStage(sIdx, 'prompt', { ...stage.prompt, ko: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '11px', opacity: 0.7 }}>English</label>
                    <input
                      type="text"
                      placeholder="Welcome. Start by scanning the target."
                      value={stage.prompt.en}
                      onChange={e => updateStage(sIdx, 'prompt', { ...stage.prompt, en: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <small>스테이지 시작 메시지</small>
              </div>

              {/* Default Response - Bilingual */}
              <div className="form-field" style={{ border: '1px solid #444', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                  기본 응답 메시지 (Default Response) *
                </label>
                <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '11px', opacity: 0.7 }}>한글</label>
                    <input
                      type="text"
                      placeholder="유효하지 않은 명령어입니다."
                      value={stage.defaultResponse.ko}
                      onChange={e => updateStage(sIdx, 'defaultResponse', { ...stage.defaultResponse, ko: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '11px', opacity: 0.7 }}>English</label>
                    <input
                      type="text"
                      placeholder="Invalid command."
                      value={stage.defaultResponse.en}
                      onChange={e => updateStage(sIdx, 'defaultResponse', { ...stage.defaultResponse, en: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <small>잘못된 명령어 응답</small>
              </div>

              {/* Commands */}
              <div className="commands-section">
                <div className="commands-header">
                  <label>명령어 목록 ({stage.commands.length})</label>
                  <button type="button" onClick={() => addCommand(sIdx)} className="btn-add-small">
                    <FaPlus /> 추가
                  </button>
                </div>

                {stage.commands.map((cmd, cIdx) => (
                  <div key={cIdx} className="command-card">
                    <div className="command-header">
                      <span>Command {cIdx + 1}</span>
                      <button type="button" onClick={() => removeCommand(sIdx, cIdx)}>
                        <FaTrash />
                      </button>
                    </div>

                    <div className="command-inputs">
                      {/* Command */}
                      <div className="input-group">
                        <label>명령어 *</label>
                        <input
                          type="text"
                          placeholder="nmap -sV"
                          value={cmd.command}
                          onChange={e => updateCommand(sIdx, cIdx, 'command', e.target.value)}
                          required
                        />
                      </div>

                      {/* Args (Optional) */}
                      <div className="input-group">
                        <label>추가 인자 (선택, 쉼표로 구분)</label>
                        <input
                          type="text"
                          placeholder="-sV, 192.168.1.1"
                          value={cmd.args?.join(', ') || ''}
                          onChange={e => {
                            const args = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                            updateCommand(sIdx, cIdx, 'args', args.length > 0 ? args : undefined);
                          }}
                        />
                      </div>

                      {/* Response - Bilingual */}
                      <div className="input-group full-width" style={{ border: '1px solid #555', padding: '10px', borderRadius: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                          응답 메시지 (Response Message) *
                        </label>
                        <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
                          <div style={{ display: 'grid', gap: '4px' }}>
                            <label style={{ fontSize: '10px', opacity: 0.7 }}>한글</label>
                            <textarea
                              rows={3}
                              placeholder="Port 80 (HTTP), 22 (SSH) 발견"
                              value={cmd.response.ko}
                              onChange={e => updateCommand(sIdx, cIdx, 'response', { ...cmd.response, ko: e.target.value })}
                              required
                            />
                          </div>
                          <div style={{ display: 'grid', gap: '4px' }}>
                            <label style={{ fontSize: '10px', opacity: 0.7 }}>English</label>
                            <textarea
                              rows={3}
                              placeholder="Port 80 (HTTP), 22 (SSH) found"
                              value={cmd.response.en}
                              onChange={e => updateCommand(sIdx, cIdx, 'response', { ...cmd.response, en: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Progress Delta */}
                      <div className="input-group">
                        <label>진행도 증가량 (0-100)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={cmd.progressDelta || 0}
                          onChange={e => updateCommand(sIdx, cIdx, 'progressDelta', Number(e.target.value))}
                        />
                      </div>

                      {/* Checkboxes */}
                      <div className="checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={cmd.advanceStage || false}
                            onChange={e => updateCommand(sIdx, cIdx, 'advanceStage', e.target.checked)}
                          />
                          <span>다음 스테이지로 진행</span>
                        </label>

                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={cmd.flagFound || false}
                            onChange={e => updateCommand(sIdx, cIdx, 'flagFound', e.target.checked)}
                          />
                          <span>플래그 발견 (게임 종료)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
};

export default TerminalRaceForm;