import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/forms/ForensicsRushForm.scss';

interface EvidenceFile {
  id: string;
  name: string;
  type: 'log' | 'pcap' | 'memory' | 'filesystem' | 'image';
  path: string;
  description: {
    ko: string;
    en: string;
  };
  content?: string;  // ✅ 파일의 실제 내용
}

interface Question {
  id: string;
  question: {
    ko: string;
    en: string;
  };
  type: 'text' | 'multiple-choice' | 'ip-address' | 'timestamp';
  answer: string | string[];
  points: number;
  hints?: {
    ko: string[];
    en: string[];
  };
  relatedFiles: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

interface ForensicsRushData {
  scenario: {
    title: {
      ko: string;
      en: string;
    };
    description: {
      ko: string;
      en: string;
    };
    incidentType: 'ransomware' | 'breach' | 'ddos' | 'insider' | 'phishing';
    date: string;
    context: {
      ko: string;
      en: string;
    };
  };
  evidenceFiles: EvidenceFile[];
  availableTools: string[];
  questions: Question[];
  scoring: {
    wrongAnswerPenalty: number;
    perfectScoreBonus: number;
    speedBonus: boolean;
  };
  totalQuestions: number;
}

interface Props {
  data: ForensicsRushData;
  onChange: (data: ForensicsRushData) => void;
}

const ForensicsRushForm: React.FC<Props> = ({ data, onChange }) => {
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

  // Evidence Files
  const addEvidenceFile = () => {
    onChange({
      ...data,
      evidenceFiles: [
        ...data.evidenceFiles,
        {
          id: `evidence_${Date.now()}`,
          name: '',
          type: 'log',
          path: '',
          description: { ko: '', en: '' },
          content: ''  // ✅ 빈 content 초기화
        }
      ]
    });
  };

  const removeEvidenceFile = (index: number) => {
    onChange({
      ...data,
      evidenceFiles: data.evidenceFiles.filter((_, i) => i !== index)
    });
  };

  const updateEvidenceFile = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      evidenceFiles: data.evidenceFiles.map((e, i) => 
        i === index ? { ...e, [field]: value } : e
      )
    });
  };

  // Questions
  const addQuestion = () => {
    onChange({
      ...data,
      questions: [
        ...data.questions,
        {
          id: `q_${Date.now()}`,
          question: { ko: '', en: '' },
          type: 'text',
          answer: '',
          points: 10,
          hints: { ko: [], en: [] },
          relatedFiles: [],
          difficulty: 'medium'
        }
      ],
      totalQuestions: data.questions.length + 1
    });
  };

  const removeQuestion = (index: number) => {
    onChange({
      ...data,
      questions: data.questions.filter((_, i) => i !== index),
      totalQuestions: data.questions.length - 1
    });
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      questions: data.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    });
  };

  return (
    <div className="forensics-rush-form">
      <div className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>Forensics Rush 시나리오</h3>
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
  "scenario": {
    "incidentType": "ransomware",
    "date": "2024-01-15",
    "context": {
      "ko": "사고 배경...",
      "en": "Incident context..."
    }
  },
  "evidenceFiles": [...],
  "questions": [...],
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
          {/* 사고 시나리오 정보 */}
          <div className="form-section">
        <h4>사고 시나리오</h4>

        {/* 시나리오 제목 - Bilingual */}
        <div className="form-field" style={{ border: '1px solid #444', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
            시나리오 제목 *
          </label>
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>한글</label>
              <input
                type="text"
                placeholder="예: 랜섬웨어 감염 사건"
                value={data.scenario.title?.ko || ''}
                onChange={e => onChange({
                  ...data,
                  scenario: { ...data.scenario, title: { ...data.scenario.title, ko: e.target.value } }
                })}
                required
              />
            </div>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>English</label>
              <input
                type="text"
                placeholder="e.g., Ransomware Infection Incident"
                value={data.scenario.title?.en || ''}
                onChange={e => onChange({
                  ...data,
                  scenario: { ...data.scenario, title: { ...data.scenario.title, en: e.target.value } }
                })}
                required
              />
            </div>
          </div>
        </div>

        {/* 시나리오 설명 - Bilingual */}
        <div className="form-field" style={{ border: '1px solid #444', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
            시나리오 설명 *
          </label>
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>한글</label>
              <textarea
                rows={2}
                placeholder="시나리오에 대한 간략한 설명"
                value={data.scenario.description?.ko || ''}
                onChange={e => onChange({
                  ...data,
                  scenario: { ...data.scenario, description: { ...data.scenario.description, ko: e.target.value } }
                })}
                required
              />
            </div>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>English</label>
              <textarea
                rows={2}
                placeholder="Brief description of the scenario"
                value={data.scenario.description?.en || ''}
                onChange={e => onChange({
                  ...data,
                  scenario: { ...data.scenario, description: { ...data.scenario.description, en: e.target.value } }
                })}
                required
              />
            </div>
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-field">
            <label>사고 유형 *</label>
            <select
              value={data.scenario.incidentType}
              onChange={e => onChange({
                ...data,
                scenario: { ...data.scenario, incidentType: e.target.value as any }
              })}
              required
            >
              <option value="ransomware">Ransomware</option>
              <option value="breach">Data Breach</option>
              <option value="ddos">DDoS Attack</option>
              <option value="insider">Insider Threat</option>
              <option value="phishing">Phishing Attack</option>
            </select>
          </div>
        </div>

        <div className="form-field">
          <label>사고 발생 날짜/시간 *</label>
          <input
            type="text"
            placeholder="2025년 11월 13일 오전 2시"
            value={data.scenario.date}
            onChange={e => onChange({
              ...data,
              scenario: { ...data.scenario, date: e.target.value }
            })}
            required
          />
        </div>

        {/* Context - Bilingual */}
        <div className="form-field" style={{ border: '1px solid #444', padding: '12px', borderRadius: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
            배경 정보 (Context) *
          </label>
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>한글</label>
              <textarea
                rows={3}
                placeholder="보안팀이 발견한 정보, 피해 범위, 조치 상황 등"
                value={data.scenario.context.ko}
                onChange={e => onChange({
                  ...data,
                  scenario: { ...data.scenario, context: { ...data.scenario.context, ko: e.target.value } }
                })}
                required
              />
            </div>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>English</label>
              <textarea
                rows={3}
                placeholder="Information found by security team, damage scope, actions taken, etc."
                value={data.scenario.context.en}
                onChange={e => onChange({
                  ...data,
                  scenario: { ...data.scenario, context: { ...data.scenario.context, en: e.target.value } }
                })}
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* 증거 파일 */}
      <div className="form-section">
        <div className="section-header">
          <h4>증거 파일 ({data.evidenceFiles.length})</h4>
          <button type="button" onClick={addEvidenceFile} className="btn-add">
            <FaPlus /> 추가
          </button>
        </div>

        {data.evidenceFiles.map((file, idx) => (
          <div key={idx} className="evidence-card">
            <div className="evidence-header">
              <span>#{idx + 1} {file.name || '이름 없음'}</span>
              <button type="button" onClick={() => removeEvidenceFile(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="evidence-inputs">
              <div className="input-row-2">
                <div className="input-group">
                  <label>파일 이름 *</label>
                  <input
                    type="text"
                    placeholder="access.log"
                    value={file.name}
                    onChange={e => updateEvidenceFile(idx, 'name', e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>파일 타입 *</label>
                  <select
                    value={file.type}
                    onChange={e => updateEvidenceFile(idx, 'type', e.target.value)}
                    required
                  >
                    <option value="log">Log File</option>
                    <option value="pcap">Network Capture (PCAP)</option>
                    <option value="memory">Memory Dump</option>
                    <option value="filesystem">Filesystem</option>
                    <option value="image">Disk Image</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label>파일 경로 (서버상의 위치) *</label>
                <input
                  type="text"
                  placeholder="/var/log/apache2/access.log"
                  value={file.path}
                  onChange={e => updateEvidenceFile(idx, 'path', e.target.value)}
                  required
                />
                <small>파일 경로</small>
              </div>

              {/* Description - Bilingual */}
              <div className="input-group" style={{ border: '1px solid #555', padding: '10px', borderRadius: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  설명 (Description) *
                </label>
                <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '10px', opacity: 0.7 }}>한글</label>
                    <input
                      type="text"
                      placeholder="웹 서버 접근 로그, 공격 시도 기록 포함"
                      value={file.description.ko}
                      onChange={e => updateEvidenceFile(idx, 'description', { ...file.description, ko: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '10px', opacity: 0.7 }}>English</label>
                    <input
                      type="text"
                      placeholder="Web server access log, including attack attempts"
                      value={file.description.en}
                      onChange={e => updateEvidenceFile(idx, 'description', { ...file.description, en: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* ✅ 파일 내용 입력 (새로 추가) */}
              <div className="input-group">
                <label>파일 내용 (실제 로그/데이터) *</label>
                <textarea
                  rows={10}
                  className="file-content-input"
                  placeholder="192.168.1.10 - - [13/Nov/2025:02:45:23 +0000] GET /index.php HTTP/1.1 200 2326"
                  value={file.content || ''}
                  onChange={e => updateEvidenceFile(idx, 'content', e.target.value)}
                  required
                />
                <small>실제 로그 형식으로 작성, 답 포함 필수</small>
              </div>
            </div>
          </div>
        ))}

        {data.evidenceFiles.length === 0 && (
          <div className="empty-state">
            <p>증거 파일이 없습니다</p>
            <p className="hint">최소 1개 이상 필요</p>
          </div>
        )}
      </div>

      {/* 사용 가능한 도구 */}
      <div className="form-section">
        <h4>사용 가능한 도구</h4>
        <div className="form-field">
          <label>도구 목록 (쉼표로 구분) *</label>
          <input
            type="text"
            placeholder="grep, awk, sed, wireshark, volatility, strings, tcpdump"
            value={data.availableTools.join(', ')}
            onChange={e => onChange({
              ...data,
              availableTools: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
            })}
            required
          />
          <small>분석 도구</small>
        </div>
      </div>

      {/* 질문 */}
      <div className="form-section">
        <div className="section-header">
          <h4>질문 ({data.questions.length})</h4>
          <button type="button" onClick={addQuestion} className="btn-add">
            <FaPlus /> 추가
          </button>
        </div>

        {data.questions.map((q, idx) => (
          <div key={idx} className="question-card">
            <div className="question-header">
              <span>Q{idx + 1} {q.question?.ko || q.question?.en || '질문 없음'}</span>
              <button type="button" onClick={() => removeQuestion(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="question-inputs">
              {/* Question - Bilingual */}
              <div className="input-group" style={{ border: '1px solid #555', padding: '10px', borderRadius: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  질문 (Question) *
                </label>
                <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '10px', opacity: 0.7 }}>한글</label>
                    <input
                      type="text"
                      placeholder="공격자의 IP 주소는?"
                      value={q.question.ko}
                      onChange={e => updateQuestion(idx, 'question', { ...q.question, ko: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '10px', opacity: 0.7 }}>English</label>
                    <input
                      type="text"
                      placeholder="What is the attacker's IP address?"
                      value={q.question.en}
                      onChange={e => updateQuestion(idx, 'question', { ...q.question, en: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="input-row-3">
                <div className="input-group">
                  <label>질문 타입 *</label>
                  <select
                    value={q.type}
                    onChange={e => updateQuestion(idx, 'type', e.target.value)}
                    required
                  >
                    <option value="text">Text</option>
                    <option value="multiple-choice">Multiple Choice</option>
                    <option value="ip-address">IP Address</option>
                    <option value="timestamp">Timestamp</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>난이도 *</label>
                  <select
                    value={q.difficulty}
                    onChange={e => updateQuestion(idx, 'difficulty', e.target.value as any)}
                    required
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>배점 *</label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={q.points}
                    onChange={e => updateQuestion(idx, 'points', Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>정답 *</label>
                <input
                  type="text"
                  placeholder="정답 (여러 개인 경우 쉼표로 구분)"
                  value={Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                  onChange={e => {
                    const value = e.target.value;
                    // 항상 배열로 저장 (쉼표로 구분)
                    const answers = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                    updateQuestion(idx, 'answer', answers);
                  }}
                  required
                />
                <small>정답 (대소문자 무시, 여러 개는 쉼표로 구분)</small>
              </div>

              {/* Hints - Bilingual */}
              <div className="input-group" style={{ border: '1px solid #555', padding: '10px', borderRadius: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  힌트 (Hints) - 선택, 쉼표로 구분
                </label>
                <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '10px', opacity: 0.7 }}>한글</label>
                    <input
                      type="text"
                      placeholder="access.log 파일을 확인하세요, grep 명령어를 사용하세요"
                      value={q.hints?.ko?.join(', ') || ''}
                      onChange={e => updateQuestion(idx, 'hints', {
                        ko: e.target.value ? e.target.value.split(',').map(s => s.trim()) : [],
                        en: q.hints?.en || []
                      })}
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '10px', opacity: 0.7 }}>English</label>
                    <input
                      type="text"
                      placeholder="Check the access.log file, Use the grep command"
                      value={q.hints?.en?.join(', ') || ''}
                      onChange={e => updateQuestion(idx, 'hints', {
                        ko: q.hints?.ko || [],
                        en: e.target.value ? e.target.value.split(',').map(s => s.trim()) : []
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label>관련 증거 파일 (선택, 증거 파일 ID를 쉼표로 구분)</label>
                <input
                  type="text"
                  placeholder="evidence_1, evidence_2"
                  value={q.relatedFiles.join(', ')}
                  onChange={e => updateQuestion(idx, 'relatedFiles', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                />
                <small>관련 증거 파일</small>
              </div>
            </div>
          </div>
        ))}

        {data.questions.length === 0 && (
          <div className="empty-state">
            <p>질문이 없습니다</p>
            <p className="hint">최소 3개 이상 권장</p>
          </div>
        )}
      </div>

      {/* 점수 시스템 */}
      <div className="form-section">
        <h4>점수 시스템</h4>
        <div className="form-grid-3">
          <div className="form-field">
            <label>오답 페널티 *</label>
            <input
              type="number"
              min={0}
              value={data.scoring.wrongAnswerPenalty}
              onChange={e => onChange({
                ...data,
                scoring: { ...data.scoring, wrongAnswerPenalty: Number(e.target.value) }
              })}
              required
            />
            <small>오답 시 감점</small>
          </div>

          <div className="form-field">
            <label>완벽 점수 보너스 *</label>
            <input
              type="number"
              min={0}
              value={data.scoring.perfectScoreBonus}
              onChange={e => onChange({
                ...data,
                scoring: { ...data.scoring, perfectScoreBonus: Number(e.target.value) }
              })}
              required
            />
            <small>전부 정답 시 보너스</small>
          </div>

          <div className="form-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={data.scoring.speedBonus}
                onChange={e => onChange({
                  ...data,
                  scoring: { ...data.scoring, speedBonus: e.target.checked }
                })}
              />
              <span>속도 보너스</span>
            </label>
            <small>빠르게 풀면 추가 점수</small>
          </div>
        </div>
      </div>

      {/* 요약 정보 */}
      <div className="form-section summary-section">
        <h4>시나리오 요약</h4>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">증거 파일</span>
            <span className="summary-value">{data.evidenceFiles.length}개</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">질문</span>
            <span className="summary-value">{data.questions.length}개</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">총점</span>
            <span className="summary-value">
              {data.questions.reduce((sum, q) => sum + q.points, 0)}pt
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">상태</span>
            <span className={`summary-value ${
              data.evidenceFiles.length > 0 &&
              data.questions.length >= 3 &&
              data.evidenceFiles.every(f => f.content) ? 'complete' : 'incomplete'
            }`}>
              {data.evidenceFiles.length > 0 &&
               data.questions.length >= 3 &&
               data.evidenceFiles.every(f => f.content) ? '완성' : '미완성'}
            </span>
          </div>
        </div>
        
        {(!data.evidenceFiles.every(f => f.content) || data.questions.length < 3) && (
          <div className="warning-box">
            <strong>누락된 항목:</strong>
            <ul>
              {!data.evidenceFiles.every(f => f.content) && (
                <li>일부 증거 파일 내용 누락</li>
              )}
              {data.questions.length < 3 && (
                <li>질문 (최소 3개 권장)</li>
              )}
            </ul>
          </div>
        )}
        </div>
        </>
      )}
    </div>
  );
};

export default ForensicsRushForm;