import React from 'react';
import { FaPlus, FaMinus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/forms/TerminalRaceForm.scss';

interface Command {
  command: string;
  args?: string[];
  response: string;
  progressDelta?: number;
  advanceStage?: boolean;
  flagFound?: boolean;
}

interface Stage {
  stage: number;
  prompt: string;
  commands: Command[];
  defaultResponse: string;
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
  
  const addStage = () => {
    onChange({
      ...data,
      totalStages: data.stages.length + 1,
      stages: [
        ...data.stages,
        { 
          stage: data.stages.length + 1, 
          prompt: '', 
          commands: [],
          defaultResponse: '유효하지 않은 명령어입니다.'
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
              response: '', 
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
        <button type="button" onClick={addStage} className="btn-add">
          <FaPlus /> 추가
        </button>
      </div>

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
              {/* Prompt */}
              <div className="form-field">
                <label>프롬프트 메시지 *</label>
                <input
                  type="text"
                  placeholder="Welcome. Start by scanning the target."
                  value={stage.prompt}
                  onChange={e => updateStage(sIdx, 'prompt', e.target.value)}
                  required
                />
                <small>스테이지 시작 메시지</small>
              </div>

              {/* Default Response */}
              <div className="form-field">
                <label>기본 응답 메시지 *</label>
                <input
                  type="text"
                  placeholder="유효하지 않은 명령어입니다."
                  value={stage.defaultResponse}
                  onChange={e => updateStage(sIdx, 'defaultResponse', e.target.value)}
                  required
                />
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

                      {/* Response */}
                      <div className="input-group full-width">
                        <label>응답 메시지 *</label>
                        <textarea
                          rows={3}
                          placeholder="Port 80 (HTTP), 22 (SSH) 발견"
                          value={cmd.response}
                          onChange={e => updateCommand(sIdx, cIdx, 'response', e.target.value)}
                          required
                        />
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
    </div>
  );
};

export default TerminalRaceForm;