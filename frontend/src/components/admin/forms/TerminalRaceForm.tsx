import React from 'react';
import { FaPlus, FaMinus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/TerminalRaceForm.scss';

interface Command {
  command: string;
  message: string;
  scoreGain: number;
  advanceStage: boolean;
}

interface Stage {
  stage: number;
  prompt: string;
  commands: Command[];
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
        { stage: data.stages.length + 1, prompt: '', commands: [] }
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

  const updateStagePrompt = (index: number, prompt: string) => {
    onChange({
      ...data,
      stages: data.stages.map((s, i) => i === index ? { ...s, prompt } : s)
    });
  };

  const addCommand = (stageIndex: number) => {
    onChange({
      ...data,
      stages: data.stages.map((s, i) => 
        i === stageIndex ? {
          ...s,
          commands: [...s.commands, { command: '', message: '', scoreGain: 0, advanceStage: false }]
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
        <h3>Stages ({data.stages.length})</h3>
        <button type="button" onClick={addStage}>
          <FaPlus /> Add Stage
        </button>
      </div>

      {data.stages.map((stage, sIdx) => (
        <div key={sIdx} className="stage-card">
          <div className="stage-header">
            <strong>Stage {sIdx + 1}</strong>
            {data.stages.length > 1 && (
              <button type="button" onClick={() => removeStage(sIdx)}>
                <FaMinus /> Remove
              </button>
            )}
          </div>

          <div className="stage-prompt">
            <label>Prompt *</label>
            <input
              type="text"
              placeholder="e.g., Welcome. Start by scanning the target."
              value={stage.prompt}
              onChange={e => updateStagePrompt(sIdx, e.target.value)}
              required
            />
          </div>

          {/* Commands */}
          <div className="commands-section">
            <div className="commands-header">
              <label>Commands ({stage.commands.length})</label>
              <button type="button" onClick={() => addCommand(sIdx)}>
                <FaPlus /> Add Command
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
                  <input
                    type="text"
                    placeholder="command (e.g., nmap -sV)"
                    value={cmd.command}
                    onChange={e => updateCommand(sIdx, cIdx, 'command', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    placeholder="score"
                    min={0}
                    value={cmd.scoreGain}
                    onChange={e => updateCommand(sIdx, cIdx, 'scoreGain', Number(e.target.value))}
                  />
                  <div className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={cmd.advanceStage}
                      onChange={e => updateCommand(sIdx, cIdx, 'advanceStage', e.target.checked)}
                    />
                    <span>Next Stage</span>
                  </div>
                </div>

                <textarea
                  rows={2}
                  placeholder="Response message..."
                  value={cmd.message}
                  onChange={e => updateCommand(sIdx, cIdx, 'message', e.target.value)}
                  required
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TerminalRaceForm;