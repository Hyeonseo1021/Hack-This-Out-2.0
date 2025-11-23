import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/forms/VulnerabilityScannerRaceForm.scss';

interface Vulnerability {
  vulnId: string;
  name: string;
  vulnType: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  endpoint: string;
  parameter: string;
  description: string;
  points: number;
  validation: {
    method: string;
    expectedPayload: string;
  };
}

interface VulnerabilityScannerRaceData {
  targetUrl: string;
  targetName: string;
  targetDescription: string;
  mode: 'SIMULATED' | 'REAL';
  vulnerabilities: Vulnerability[];
  scoring: {
    firstBloodBonus: number;
    invalidSubmissionPenalty: number;
  };
}

interface Props {
  data: VulnerabilityScannerRaceData;
  onChange: (data: VulnerabilityScannerRaceData) => void;
}

const VulnerabilityScannerRaceForm: React.FC<Props> = ({ data, onChange }) => {

  // 취약점 추가
  const addVulnerability = () => {
    onChange({
      ...data,
      vulnerabilities: [
        ...data.vulnerabilities,
        {
          vulnId: `vuln_${Date.now()}`,
          name: '',
          vulnType: 'SQLi',
          severity: 'MEDIUM',
          endpoint: '/',
          parameter: '',
          description: '',
          points: 50,
          validation: {
            method: 'pattern',
            expectedPayload: ''
          }
        }
      ]
    });
  };

  // 취약점 삭제
  const removeVulnerability = (index: number) => {
    onChange({
      ...data,
      vulnerabilities: data.vulnerabilities.filter((_, i) => i !== index)
    });
  };

  // 취약점 업데이트
  const updateVulnerability = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      vulnerabilities: data.vulnerabilities.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      )
    });
  };

  // 취약점의 validation 필드 업데이트
  const updateValidation = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      vulnerabilities: data.vulnerabilities.map((v, i) =>
        i === index ? { ...v, validation: { ...v.validation, [field]: value } } : v
      )
    });
  };

  return (
    <div className="vulnerability-scanner-race-form">
      <h3>Vulnerability Scanner Race 시나리오</h3>

      {/* 타겟 정보 */}
      <div className="form-section">
        <h4>타겟 정보</h4>

        <div className="form-field">
          <label>모드 *</label>
          <select
            value={data.mode || 'SIMULATED'}
            onChange={e => onChange({ ...data, mode: e.target.value as 'SIMULATED' | 'REAL' })}
            required
          >
            <option value="SIMULATED">SIMULATED (AI 자동 생성)</option>
            <option value="REAL">REAL (실제 URL)</option>
          </select>
          <small>
            SIMULATED: AI가 HTML 자동 생성 | REAL: 실제 URL 제공
          </small>
        </div>

        <div className="form-field">
          <label>타겟 이름 *</label>
          <input
            type="text"
            placeholder="SecureBank Login Portal"
            value={data.targetName || ''}
            onChange={e => onChange({ ...data, targetName: e.target.value })}
            required
          />
        </div>

        <div className="form-field">
          <label>타겟 설명 *</label>
          <textarea
            rows={2}
            placeholder="A vulnerable banking login portal"
            value={data.targetDescription || ''}
            onChange={e => onChange({ ...data, targetDescription: e.target.value })}
            required
          />
        </div>

        {data.mode === 'REAL' && (
          <div className="form-field">
            <label>타겟 URL *</label>
            <input
              type="url"
              placeholder="https://vulnerable-app.example.com"
              value={data.targetUrl || ''}
              onChange={e => onChange({ ...data, targetUrl: e.target.value })}
              required
            />
            <small>취약한 웹 애플리케이션 URL</small>
          </div>
        )}
      </div>

      {/* 취약점 목록 */}
      <div className="form-section">
        <div className="section-header">
          <h4>취약점 목록 ({data.vulnerabilities?.length || 0})</h4>
          <button type="button" onClick={addVulnerability} className="btn-add">
            <FaPlus /> 추가
          </button>
        </div>

        {(data.vulnerabilities || []).map((vuln, idx) => (
          <div key={idx} className="vulnerability-card">
            <div className="card-header">
              <span>
                #{idx + 1} {vuln.name || '이름 없음'}
              </span>
              <button type="button" onClick={() => removeVulnerability(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="card-content">
              {/* 기본 정보 */}
              <div className="input-row-2">
                <div className="input-group">
                  <label>취약점 이름 *</label>
                  <input
                    type="text"
                    placeholder="Login SQL Injection"
                    value={vuln.name}
                    onChange={e => updateVulnerability(idx, 'name', e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>취약점 타입 *</label>
                  <select
                    value={vuln.vulnType}
                    onChange={e => updateVulnerability(idx, 'vulnType', e.target.value)}
                    required
                  >
                    <option value="SQLi">SQL Injection</option>
                    <option value="XSS">Cross-Site Scripting (XSS)</option>
                    <option value="CSRF">CSRF</option>
                    <option value="IDOR">IDOR</option>
                    <option value="Path Traversal">Path Traversal</option>
                    <option value="Command Injection">Command Injection</option>
                    <option value="Broken Authentication">Broken Authentication</option>
                    <option value="Security Misconfiguration">Security Misconfiguration</option>
                  </select>
                </div>
              </div>

              <div className="input-row-3">
                <div className="input-group">
                  <label>심각도 *</label>
                  <select
                    value={vuln.severity}
                    onChange={e => updateVulnerability(idx, 'severity', e.target.value)}
                    required
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>엔드포인트 *</label>
                  <input
                    type="text"
                    placeholder="/login"
                    value={vuln.endpoint}
                    onChange={e => updateVulnerability(idx, 'endpoint', e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>파라미터 *</label>
                  <input
                    type="text"
                    placeholder="username"
                    value={vuln.parameter}
                    onChange={e => updateVulnerability(idx, 'parameter', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>설명 *</label>
                <textarea
                  rows={2}
                  placeholder="SQL injection vulnerability in login form"
                  value={vuln.description}
                  onChange={e => updateVulnerability(idx, 'description', e.target.value)}
                  required
                />
              </div>

              <div className="input-row-2">
                <div className="input-group">
                  <label>배점 *</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={vuln.points}
                    onChange={e => updateVulnerability(idx, 'points', Number(e.target.value))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>검증 방법 *</label>
                  <select
                    value={vuln.validation?.method || 'pattern'}
                    onChange={e => updateValidation(idx, 'method', e.target.value)}
                    required
                  >
                    <option value="pattern">Pattern (포함 여부)</option>
                    <option value="exact">Exact (정확히 일치)</option>
                    <option value="regex">Regex (정규식)</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label>예상 페이로드 *</label>
                <input
                  type="text"
                  placeholder="' OR 1=1--"
                  value={vuln.validation?.expectedPayload || ''}
                  onChange={e => updateValidation(idx, 'expectedPayload', e.target.value)}
                  required
                />
                <small>패턴 모드: 문자열 포함 시 정답 처리</small>
              </div>
            </div>
          </div>
        ))}

        {(!data.vulnerabilities || data.vulnerabilities.length === 0) && (
          <div className="empty-state">
            <p>취약점이 없습니다</p>
            <p className="hint">최소 1개 이상 필요</p>
          </div>
        )}
      </div>

      {/* 점수 시스템 */}
      <div className="form-section">
        <h4>점수 시스템</h4>
        <div className="form-grid-2">
          <div className="form-field">
            <label>First Blood 보너스 *</label>
            <input
              type="number"
              min={0}
              value={data.scoring?.firstBloodBonus || 50}
              onChange={e => onChange({
                ...data,
                scoring: { ...data.scoring, firstBloodBonus: Number(e.target.value) }
              })}
              required
            />
            <small>최초 발견 보너스</small>
          </div>

          <div className="form-field">
            <label>오답 페널티 *</label>
            <input
              type="number"
              min={0}
              value={data.scoring?.invalidSubmissionPenalty || 5}
              onChange={e => onChange({
                ...data,
                scoring: { ...data.scoring, invalidSubmissionPenalty: Number(e.target.value) }
              })}
              required
            />
            <small>오답 시 감점</small>
          </div>
        </div>
      </div>

      {/* 요약 정보 */}
      <div className="form-section summary-section">
        <h4>시나리오 요약</h4>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">모드</span>
            <span className="summary-value">
              {(data.mode || 'SIMULATED') === 'SIMULATED' ? 'SIMULATED' : 'REAL'}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">취약점</span>
            <span className="summary-value">{data.vulnerabilities?.length || 0}개</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">총점</span>
            <span className="summary-value">
              {(data.vulnerabilities || []).reduce((sum, v) => sum + v.points, 0)}pt
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">상태</span>
            <span className={`summary-value ${
              data.vulnerabilities?.length > 0 &&
              data.targetName &&
              data.targetDescription ? 'complete' : 'incomplete'
            }`}>
              {data.vulnerabilities?.length > 0 &&
               data.targetName &&
               data.targetDescription ? '완성' : '미완성'}
            </span>
          </div>
        </div>

        {(!data.vulnerabilities?.length || !data.targetName || !data.targetDescription) && (
          <div className="warning-box">
            <strong>누락된 항목:</strong>
            <ul>
              {!data.targetName && <li>타겟 이름</li>}
              {!data.targetDescription && <li>타겟 설명</li>}
              {!data.vulnerabilities?.length && <li>취약점 (최소 1개)</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default VulnerabilityScannerRaceForm;
