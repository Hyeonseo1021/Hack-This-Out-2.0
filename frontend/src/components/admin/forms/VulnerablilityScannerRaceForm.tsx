import React, { useState } from 'react';
import '../../../assets/scss/admin/forms/VulnerabilityScannerRaceForm.scss';

interface VulnerabilityScannerRaceFormProps {
  data: any;
  onChange: (data: any) => void;
}

const VulnerabilityScannerRaceForm: React.FC<VulnerabilityScannerRaceFormProps> = ({ 
  data, 
  onChange 
}) => {
  const [viewMode, setViewMode] = useState<'simple' | 'json'>('simple');
  const [jsonText, setJsonText] = useState(JSON.stringify(data, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // JSON 모드에서 텍스트 변경 처리
  const handleJsonChange = (value: string) => {
    setJsonText(value);
    setJsonError(null);
    
    try {
      const parsed = JSON.parse(value);
      onChange(parsed);
    } catch (error: any) {
      setJsonError(error.message);
    }
  };

  // 기본 정보 변경 처리
  const handleFieldChange = (field: string, value: any) => {
    const newData = { ...data, [field]: value };
    onChange(newData);
    setJsonText(JSON.stringify(newData, null, 2));
  };

  // JSON 포맷팅
  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonText(formatted);
      setJsonError(null);
    } catch (error: any) {
      setJsonError('Invalid JSON: ' + error.message);
    }
  };

  return (
    <div className="vulnerability-scanner-race-form">
      {/* 모드 전환 탭 */}
      <div className="mode-tabs">
        <button 
          className={`tab ${viewMode === 'simple' ? 'active' : ''}`}
          onClick={() => setViewMode('simple')}
          type="button"
        >
          📝 Basic Info
        </button>
        <button 
          className={`tab ${viewMode === 'json' ? 'active' : ''}`}
          onClick={() => setViewMode('json')}
          type="button"
        >
          💻 JSON Editor
        </button>
      </div>

      {/* Simple 모드 */}
      {viewMode === 'simple' && (
        <div className="simple-mode">
          <div className="form-section">
            <h3>🎯 Target Information</h3>
            
            <div className="form-group">
              <label>Target URL *</label>
              <input 
                type="text" 
                value={data.targetUrl || ''} 
                onChange={e => handleFieldChange('targetUrl', e.target.value)}
                placeholder="https://vulnerable-app.example.com"
                required
              />
            </div>

            <div className="form-group">
              <label>Target Name *</label>
              <input 
                type="text" 
                value={data.targetName || ''} 
                onChange={e => handleFieldChange('targetName', e.target.value)}
                placeholder="Vulnerable App v1.0"
                required
              />
            </div>

            <div className="form-group">
              <label>Target Description</label>
              <textarea 
                value={data.targetDescription || ''} 
                onChange={e => handleFieldChange('targetDescription', e.target.value)}
                placeholder="A web application with various security vulnerabilities for testing purposes"
                rows={3}
              />
            </div>
          </div>

          <div className="warning-box">
            <h4>⚠️ Complex Data Entry Required</h4>
            <p>
              <strong>Vulnerabilities, Features, Hints, and Scoring</strong> settings are complex structures.
            </p>
            <p>
              Please use the <strong>JSON Editor</strong> tab or import a complete JSON file to configure these.
            </p>
            <p className="stats">
              📊 Current Data: 
              <span className="stat">
                {data.vulnerabilities?.length || 0} vulnerabilities
              </span>
              <span className="stat">
                {data.features?.length || 0} features
              </span>
              <span className="stat">
                {data.hints?.length || 0} hints
              </span>
            </p>
          </div>

          <div className="info-box">
            <h4>💡 Recommended Workflow</h4>
            <ol>
              <li>Download the <strong>JSON template</strong> from the main page</li>
              <li>Edit the JSON file with your vulnerabilities and settings</li>
              <li>Use <strong>Import from JSON</strong> feature to create the scenario</li>
            </ol>
            <p>
              Or switch to <strong>JSON Editor</strong> tab to edit directly in the browser.
            </p>
          </div>
        </div>
      )}

      {/* JSON 모드 */}
      {viewMode === 'json' && (
        <div className="json-mode">
          <div className="json-editor-header">
            <h3>💻 JSON Editor</h3>
            <button 
              type="button"
              className="btn-format" 
              onClick={formatJson}
              title="Format JSON"
            >
              ✨ Format
            </button>
          </div>

          {jsonError && (
            <div className="json-error">
              ❌ JSON Error: {jsonError}
            </div>
          )}

          <textarea 
            className={`json-editor ${jsonError ? 'error' : ''}`}
            value={jsonText}
            onChange={e => handleJsonChange(e.target.value)}
            rows={25}
            spellCheck={false}
            placeholder="Enter JSON data here..."
          />

          <div className="json-help">
            <details>
              <summary>📖 JSON Structure Reference</summary>
              <pre className="json-reference">
{`{
  "targetUrl": "https://example.com",
  "targetName": "Example App",
  "targetDescription": "Description here",
  "features": ["Feature 1", "Feature 2"],
  "vulnerabilities": [
    {
      "name": "SQL Injection",
      "type": "SQLi",
      "severity": "CRITICAL",
      "cve": "CVE-2023-12345",
      "owasp": "A03:2021",
      "points": 100,
      "description": "SQL injection in login form"
    }
  ],
  "hints": [
    {
      "order": 1,
      "text": "Check the login parameters",
      "unlockAfterSeconds": 300
    }
  ],
  "scoring": {
    "firstBloodBonus": 50,
    "speedBonusThresholds": {
      "under3min": 30,
      "under5min": 20,
      "under7min": 10
    },
    "comboMultiplier": 5,
    "invalidSubmissionPenalty": 5
  },
  "totalVulnerabilities": 1
}`}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};

export default VulnerabilityScannerRaceForm;