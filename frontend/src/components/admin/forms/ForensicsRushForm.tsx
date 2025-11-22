import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/forms/ForensicsRushForm.scss';

interface EvidenceFile {
  id: string;
  name: string;
  type: 'log' | 'pcap' | 'memory' | 'filesystem' | 'image';
  path: string;
  description: string;
  content?: string;  // ✅ 파일의 실제 내용
}

interface Question {
  id: string;
  question: string;
  type: 'text' | 'multiple-choice' | 'ip-address' | 'timestamp';
  answer: string | string[];
  points: number;
  hints?: string[];
  relatedFiles: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

interface ForensicsRushData {
  scenario: {
    title: string;
    description: string;
    incidentType: 'ransomware' | 'breach' | 'ddos' | 'insider' | 'phishing';
    date: string;
    context: string;
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
          description: '',
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
          question: '',
          type: 'text',
          answer: '',
          points: 10,
          hints: [],
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
      <h3>Forensics Rush 시나리오</h3>

      {/* 사고 시나리오 정보 */}
      <div className="form-section">
        <h4>사고 시나리오</h4>
        
        <div className="form-grid-2">
          <div className="form-field">
            <label>시나리오 제목 *</label>
            <input
              type="text"
              placeholder="랜섬웨어 감염 사고"
              value={data.scenario.title}
              onChange={e => onChange({ 
                ...data, 
                scenario: { ...data.scenario, title: e.target.value }
              })}
              required
            />
          </div>

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

        <div className="form-field">
          <label>시나리오 설명 *</label>
          <textarea
            rows={2}
            placeholder="회사 파일 서버가 랜섬웨어에 감염되어 모든 파일이 암호화되었습니다."
            value={data.scenario.description}
            onChange={e => onChange({ 
              ...data, 
              scenario: { ...data.scenario, description: e.target.value }
            })}
            required
          />
        </div>

        <div className="form-field">
          <label>배경 정보 (Context) *</label>
          <textarea
            rows={3}
            placeholder="보안팀이 발견한 정보, 피해 범위, 조치 상황 등"
            value={data.scenario.context}
            onChange={e => onChange({ 
              ...data, 
              scenario: { ...data.scenario, context: e.target.value }
            })}
            required
          />
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

              <div className="input-group">
                <label>설명 *</label>
                <input
                  type="text"
                  placeholder="웹 서버 접근 로그, 공격 시도 기록 포함"
                  value={file.description}
                  onChange={e => updateEvidenceFile(idx, 'description', e.target.value)}
                  required
                />
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
              <span>Q{idx + 1} {q.question || '질문 없음'}</span>
              <button type="button" onClick={() => removeQuestion(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="question-inputs">
              <div className="input-group">
                <label>질문 *</label>
                <input
                  type="text"
                  placeholder="공격자의 IP 주소는?"
                  value={q.question}
                  onChange={e => updateQuestion(idx, 'question', e.target.value)}
                  required
                />
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

              <div className="input-group">
                <label>힌트 (선택, 쉼표로 구분)</label>
                <input
                  type="text"
                  placeholder="access.log 파일을 확인하세요, grep 명령어를 사용하세요"
                  value={q.hints?.join(', ') || ''}
                  onChange={e => updateQuestion(idx, 'hints', e.target.value ? e.target.value.split(',').map(s => s.trim()) : [])}
                />
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
    </div>
  );
};

export default ForensicsRushForm;