import React, { useState } from 'react';
import { FaPlus, FaTrash, FaCode, FaEdit } from 'react-icons/fa';
import '../../../assets/scss/admin/forms/VulnerabilityScannerRaceForm.scss';

interface Hint {
  hintId: string;
  vulnId: string;
  level: 1 | 2 | 3;
  text: {
    ko: string;
    en: string;
  };
  cost: number;
}

interface Vulnerability {
  vulnId: string;
  vulnType: string;
  vulnName: {
    ko: string;
    en: string;
  };
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  parameter: string;
  validation: {
    expectedPayload?: string;
    validationMethod?: 'contains' | 'exact' | 'regex' | 'stored' | 'unauthorized_access' | 'missing_token';
    validationCriteria?: {
      responseContains?: string;
      statusCode?: number;
      differentUserId?: boolean;
      accessDenied?: boolean;
      balanceRevealed?: boolean;
      checkUrl?: string;
      pattern?: string;
      noCSRFToken?: boolean;
    };
  };
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  basePoints: number;
  category: string;
  hintIds: string[];
}

interface VulnerabilityScannerRaceData {
  targetUrl: string;
  targetName: {
    ko: string;
    en: string;
  };
  targetDescription: {
    ko: string;
    en: string;
  };
  features: string[];
  vulnerabilities: Vulnerability[];
  hints: Hint[];
  scoring: {
    invalidSubmissionPenalty: number;
    graceTimeSeconds?: number;
  };
  totalVulnerabilities: number;
}

interface Props {
  data: VulnerabilityScannerRaceData;
  onChange: (data: VulnerabilityScannerRaceData) => void;
  difficulty?: string; // 난이도 (EASY, MEDIUM, HARD, EXPERT)
}

const VulnerabilityScannerRaceForm: React.FC<Props> = ({ data, onChange, difficulty = 'EASY' }) => {

  // 난이도 기반 모드 확인
  const isEasyOrMedium = difficulty === 'EASY' || difficulty === 'MEDIUM';
  const isHardOrExpert = difficulty === 'HARD' || difficulty === 'EXPERT';
  const currentMode = isEasyOrMedium ? 'SIMULATED (AI Generated)' : 'REAL (Actual URL)';

  // 탭 상태 (form: 폼 모드, json: JSON 모드)
  const [editMode, setEditMode] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  // JSON 모드로 전환
  const switchToJsonMode = () => {
    try {
      const jsonData = {
        targetUrl: data.targetUrl || '',
        targetName: data.targetName || '',
        targetDescription: data.targetDescription || '',
        features: data.features || [],
        vulnerabilities: data.vulnerabilities || [],
        hints: data.hints || [],
        scoring: data.scoring || {
          invalidSubmissionPenalty: 5,
          graceTimeSeconds: 60
        },
        totalVulnerabilities: data.vulnerabilities?.length || 0
      };
      setJsonText(JSON.stringify(jsonData, null, 2));
      setJsonError('');
      setEditMode('json');
    } catch (error) {
      setJsonError('Failed to convert to JSON');
    }
  };

  // 폼 모드로 전환 (JSON 파싱)
  const switchToFormMode = () => {
    try {
      const parsed = JSON.parse(jsonText);
      onChange(parsed);
      setJsonError('');
      setEditMode('form');
    } catch (error) {
      setJsonError('Invalid JSON format. Please fix errors before switching to Form mode.');
    }
  };

  // 취약점 추가
  const addVulnerability = () => {
    const newVulnId = `vuln_${Date.now()}`;
    onChange({
      ...data,
      vulnerabilities: [
        ...(data.vulnerabilities || []),
        {
          vulnId: newVulnId,
          vulnType: 'SQLi',
          vulnName: { ko: '', en: '' },
          endpoint: '/',
          method: 'POST',
          parameter: '',
          validation: {
            expectedPayload: '',
            validationMethod: 'contains'
          },
          difficulty: 'EASY',
          basePoints: 50,
          category: 'Authentication',
          hintIds: []
        }
      ],
      totalVulnerabilities: (data.vulnerabilities?.length || 0) + 1
    });
  };

  // 취약점 삭제
  const removeVulnerability = (index: number) => {
    const newVulns = data.vulnerabilities.filter((_, i) => i !== index);
    onChange({
      ...data,
      vulnerabilities: newVulns,
      totalVulnerabilities: newVulns.length
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
      <div className="form-header">
        <h3>Vulnerability Scanner Race 시나리오</h3>

        {/* 편집 모드 전환 버튼 */}
        <div className="edit-mode-toggle">
          <button
            type="button"
            className={`mode-btn ${editMode === 'form' ? 'active' : ''}`}
            onClick={() => editMode === 'json' && switchToFormMode()}
          >
            <FaEdit /> Form Mode
          </button>
          <button
            type="button"
            className={`mode-btn ${editMode === 'json' ? 'active' : ''}`}
            onClick={() => editMode === 'form' && switchToJsonMode()}
          >
            <FaCode /> JSON Mode
          </button>
        </div>
      </div>

      {/* JSON 에러 메시지 */}
      {jsonError && (
        <div className="json-error">
          ⚠️ {jsonError}
        </div>
      )}

      {/* JSON 편집 모드 */}
      {editMode === 'json' && (
        <div className="json-editor-section">
          <div className="json-editor-header">
            <h4>📝 JSON Editor</h4>
            <small>Edit the scenario data directly in JSON format</small>
          </div>
          <textarea
            className="json-editor"
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setJsonError('');
            }}
            placeholder="Paste your JSON data here..."
            spellCheck={false}
          />
          <div className="json-editor-actions">
            <button
              type="button"
              className="btn-validate"
              onClick={() => {
                try {
                  JSON.parse(jsonText);
                  setJsonError('');
                  alert('✅ Valid JSON!');
                } catch (error) {
                  setJsonError('Invalid JSON syntax');
                }
              }}
            >
              Validate JSON
            </button>
            <button
              type="button"
              className="btn-apply"
              onClick={switchToFormMode}
            >
              Apply & Switch to Form
            </button>
          </div>
        </div>
      )}

      {/* 폼 편집 모드 */}
      {editMode === 'form' && (
        <>
          {/* 모드 안내 배너 */}
          <div className={`mode-indicator ${isEasyOrMedium ? 'simulated' : 'real'}`}>
            <strong>🎯 Mode: {currentMode}</strong>
            <p>
              {isEasyOrMedium
                ? '✨ AI가 취약한 HTML을 자동 생성합니다. Features 목록을 제공해주세요.'
                : '🌐 실제 취약한 웹 앱의 URL을 제공해야 합니다. Features는 선택사항입니다.'}
            </p>
          </div>

      {/* 타겟 정보 */}
      <div className="form-section">
        <h4>타겟 정보</h4>

        {/* Target Name - Bilingual */}
        <div className="form-field" style={{ border: '1px solid #444', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
            타겟 이름 (Target Name) *
          </label>
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>한글</label>
              <input
                type="text"
                placeholder="시큐어뱅크 로그인 포털"
                value={data.targetName?.ko || ''}
                onChange={e => onChange({ ...data, targetName: { ...data.targetName, ko: e.target.value } })}
                required
              />
            </div>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>English</label>
              <input
                type="text"
                placeholder="SecureBank Login Portal"
                value={data.targetName?.en || ''}
                onChange={e => onChange({ ...data, targetName: { ...data.targetName, en: e.target.value } })}
                required
              />
            </div>
          </div>
        </div>

        {/* Target Description - Bilingual */}
        <div className="form-field" style={{ border: '1px solid #444', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
            타겟 설명 (Target Description) *
          </label>
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>한글</label>
              <textarea
                rows={2}
                placeholder="취약한 은행 로그인 포털"
                value={data.targetDescription?.ko || ''}
                onChange={e => onChange({ ...data, targetDescription: { ...data.targetDescription, ko: e.target.value } })}
                required
              />
            </div>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '11px', opacity: 0.7 }}>English</label>
              <textarea
                rows={2}
                placeholder="A vulnerable banking login portal"
                value={data.targetDescription?.en || ''}
                onChange={e => onChange({ ...data, targetDescription: { ...data.targetDescription, en: e.target.value } })}
                required
              />
            </div>
          </div>
        </div>

        {/* HARD/EXPERT: 실제 URL 필수 */}
        {isHardOrExpert && (
          <div className="form-field">
            <label>타겟 URL *</label>
            <input
              type="url"
              placeholder="https://vulnerable-app.example.com"
              value={data.targetUrl || ''}
              onChange={e => onChange({ ...data, targetUrl: e.target.value })}
              required
            />
            <small>실제 취약한 웹 애플리케이션의 URL을 입력하세요</small>
          </div>
        )}

        {/* EASY/MEDIUM: Features 필수 */}
        {isEasyOrMedium && (
          <div className="form-field">
            <label>Features (기능 목록) *</label>
            <textarea
              rows={5}
              placeholder="User login&#10;Search functionality&#10;Profile viewing&#10;Money transfer&#10;Comment posting"
              value={(data.features || []).join('\n')}
              onChange={e => onChange({
                ...data,
                features: e.target.value.split('\n').filter(f => f.trim() !== '')
              })}
              required
            />
            <small>각 줄마다 하나씩 입력. AI가 이 기능들을 포함한 취약한 HTML을 생성합니다.</small>
          </div>
        )}

        {/* HARD/EXPERT: Features 선택사항 */}
        {isHardOrExpert && (
          <div className="form-field">
            <label>Features (기능 목록)</label>
            <textarea
              rows={3}
              placeholder="User login&#10;Search functionality&#10;Profile viewing (선택사항)"
              value={(data.features || []).join('\n')}
              onChange={e => onChange({
                ...data,
                features: e.target.value.split('\n').filter(f => f.trim() !== '')
              })}
            />
            <small>선택사항: 참고용 기능 목록</small>
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
                #{idx + 1} {typeof vuln.vulnName === 'object'
                  ? (vuln.vulnName.ko || vuln.vulnName.en || '이름 없음')
                  : (vuln.vulnName || '이름 없음')}
              </span>
              <button type="button" onClick={() => removeVulnerability(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="card-content">
              {/* Vuln Name - Bilingual */}
              <div className="input-group" style={{ border: '1px solid #555', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  취약점 이름 (Vulnerability Name) *
                </label>
                <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '10px', opacity: 0.7 }}>한글</label>
                    <input
                      type="text"
                      placeholder="로그인 SQL 인젝션"
                      value={vuln.vulnName?.ko || ''}
                      onChange={e => updateVulnerability(idx, 'vulnName', { ...vuln.vulnName, ko: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <label style={{ fontSize: '10px', opacity: 0.7 }}>English</label>
                    <input
                      type="text"
                      placeholder="Login SQL Injection"
                      value={vuln.vulnName?.en || ''}
                      onChange={e => updateVulnerability(idx, 'vulnName', { ...vuln.vulnName, en: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 기본 정보 */}
              <div className="input-row-2">
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
                    <option value="PATH_TRAVERSAL">Path Traversal</option>
                    <option value="COMMAND_INJECTION">Command Injection</option>
                    <option value="AUTH_BYPASS">Auth Bypass</option>
                    <option value="INFO_DISCLOSURE">Info Disclosure</option>
                    <option value="FILE_UPLOAD">File Upload</option>
                    <option value="XXE">XXE</option>
                    <option value="SSRF">SSRF</option>
                    <option value="DESERIALIZATION">Deserialization</option>
                  </select>
                </div>
              </div>

              <div className="input-row-3">
                <div className="input-group">
                  <label>난이도 *</label>
                  <select
                    value={vuln.difficulty}
                    onChange={e => updateVulnerability(idx, 'difficulty', e.target.value)}
                    required
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>카테고리 *</label>
                  <input
                    type="text"
                    placeholder="Authentication"
                    value={vuln.category}
                    onChange={e => updateVulnerability(idx, 'category', e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>배점 *</label>
                  <input
                    type="number"
                    min={10}
                    max={200}
                    value={vuln.basePoints}
                    onChange={e => updateVulnerability(idx, 'basePoints', Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="input-row-3">
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
                  <label>HTTP 메서드 *</label>
                  <select
                    value={vuln.method}
                    onChange={e => updateVulnerability(idx, 'method', e.target.value)}
                    required
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>
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

              <div className="input-row-2">
                <div className="input-group">
                  <label>검증 방법 *</label>
                  <select
                    value={vuln.validation?.validationMethod || 'contains'}
                    onChange={e => updateValidation(idx, 'validationMethod', e.target.value)}
                    required
                  >
                    <option value="contains">Contains (포함 여부)</option>
                    <option value="exact">Exact (정확히 일치)</option>
                    <option value="regex">Regex (정규식)</option>
                    <option value="stored">Stored (저장 확인)</option>
                    <option value="unauthorized_access">Unauthorized Access</option>
                    <option value="missing_token">Missing Token</option>
                  </select>
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
                </div>
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
            <label>오답 페널티 *</label>
            <input
              type="number"
              min={0}
              value={data.scoring?.invalidSubmissionPenalty || 5}
              onChange={e => onChange({
                ...data,
                scoring: {
                  ...data.scoring,
                  invalidSubmissionPenalty: Number(e.target.value),
                  graceTimeSeconds: data.scoring?.graceTimeSeconds || 60
                }
              })}
              required
            />
            <small>오답 시 감점 (무적 아이템으로 방어 가능)</small>
          </div>

          <div className="form-field">
            <label>유예시간 (초) *</label>
            <input
              type="number"
              min={0}
              value={data.scoring?.graceTimeSeconds || 60}
              onChange={e => onChange({
                ...data,
                scoring: {
                  ...data.scoring,
                  invalidSubmissionPenalty: data.scoring?.invalidSubmissionPenalty || 5,
                  graceTimeSeconds: Number(e.target.value)
                }
              })}
              required
            />
            <small>첫 완주자 발생 후 다른 플레이어들에게 주어지는 시간</small>
          </div>
        </div>

        <div className="info-box">
          <strong>점수 시스템 안내</strong>
          <ul>
            <li>각 취약점마다 설정한 기본 점수만 획득합니다</li>
            <li>점수 부스트 아이템을 사용하면 점수가 증가합니다 (예: 20% 부스트)</li>
            <li>오답 제출 시 페널티가 적용되지만, 무적 아이템으로 방어할 수 있습니다</li>
          </ul>
        </div>
      </div>

      {/* 요약 정보 */}
      <div className="form-section summary-section">
        <h4>시나리오 요약</h4>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">모드</span>
            <span className="summary-value">
              {isEasyOrMedium ? 'SIMULATED (AI)' : 'REAL URL'}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">취약점</span>
            <span className="summary-value">{data.vulnerabilities?.length || 0}개</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">총점</span>
            <span className="summary-value">
              {(data.vulnerabilities || []).reduce((sum, v) => sum + v.basePoints, 0)}pt
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Features</span>
            <span className="summary-value">{data.features?.length || 0}개</span>
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
        </>
      )}
    </div>
  );
};

export default VulnerabilityScannerRaceForm;
