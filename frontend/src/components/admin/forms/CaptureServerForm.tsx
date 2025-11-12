import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/forms/CaptureServerForm.scss';

type ServerType = 'web' | 'database' | 'ssh' | 'mail' | 'dns' | 'api' | 'ftp' | 'proxy';

interface ServerData {
  id: string;
  name: string;
  type: ServerType;
  vulnerability: string;
  captureTime: number;
  points: number;
  specialAbility: string;
}

interface CaptureServerData {
  servers: ServerData[];
  mapLayout: {
    rows: number;
    cols: number;
  };
}

interface Props {
  data: CaptureServerData;
  onChange: (data: CaptureServerData) => void;
}

const SERVER_TYPES: { value: ServerType; label: string; icon: string }[] = [
  { value: 'web', label: 'Web Server', icon: '🌐' },
  { value: 'database', label: 'Database', icon: '🗄️' },
  { value: 'ssh', label: 'SSH Server', icon: '🔐' },
  { value: 'mail', label: 'Mail Server', icon: '📧' },
  { value: 'dns', label: 'DNS Server', icon: '🌍' },
  { value: 'api', label: 'API Server', icon: '⚙️' },
  { value: 'ftp', label: 'FTP Server', icon: '📁' },
  { value: 'proxy', label: 'Proxy Server', icon: '🔀' },
];

const CaptureServerForm: React.FC<Props> = ({ data, onChange }) => {
  
  const addServer = () => {
    const newId = `server_${data.servers.length + 1}`;
    onChange({
      ...data,
      servers: [
        ...data.servers,
        { 
          id: newId, 
          name: '', 
          type: 'web',
          vulnerability: '',
          captureTime: 10, 
          points: 10,
          specialAbility: ''
        }
      ]
    });
  };

  const removeServer = (index: number) => {
    onChange({
      ...data,
      servers: data.servers.filter((_, i) => i !== index)
    });
  };

  const updateServer = (index: number, field: string, value: any) => {
    onChange({
      ...data,
      servers: data.servers.map((s, i) => 
        i === index ? { ...s, [field]: value } : s
      )
    });
  };

  const updateMapLayout = (field: 'rows' | 'cols', value: number) => {
    onChange({
      ...data,
      mapLayout: {
        ...data.mapLayout,
        [field]: value
      }
    });
  };

  return (
    <div className="capture-server-form">
      <h3>🏰 Capture The Server 시나리오</h3>

      {/* 맵 레이아웃 설정 */}
      <div className="form-section">
        <h4>맵 레이아웃</h4>
        <div className="form-grid-2">
          <div className="form-field">
            <label>행 (Rows) *</label>
            <input
              type="number"
              min={2}
              max={5}
              value={data.mapLayout.rows}
              onChange={e => updateMapLayout('rows', Number(e.target.value))}
              required
            />
            <small>맵의 세로 크기 (2-5)</small>
          </div>

          <div className="form-field">
            <label>열 (Columns) *</label>
            <input
              type="number"
              min={2}
              max={6}
              value={data.mapLayout.cols}
              onChange={e => updateMapLayout('cols', Number(e.target.value))}
              required
            />
            <small>맵의 가로 크기 (2-6)</small>
          </div>
        </div>
        <div className="map-preview">
          <span>맵 크기: {data.mapLayout.rows} × {data.mapLayout.cols} = {data.mapLayout.rows * data.mapLayout.cols}개 서버 위치</span>
        </div>
      </div>

      {/* 서버 목록 */}
      <div className="form-section">
        <div className="section-header">
          <h4>서버 목록 ({data.servers.length})</h4>
          <button type="button" onClick={addServer} className="btn-add">
            <FaPlus /> 서버 추가
          </button>
        </div>

        {data.servers.length < (data.mapLayout.rows * data.mapLayout.cols) && (
          <div className="info-box">
            ℹ️ 현재 맵에 {data.mapLayout.rows * data.mapLayout.cols - data.servers.length}개 서버를 더 추가할 수 있습니다.
          </div>
        )}

        {data.servers.length > (data.mapLayout.rows * data.mapLayout.cols) && (
          <div className="warning-box">
            ⚠️ 서버 수({data.servers.length})가 맵 크기({data.mapLayout.rows * data.mapLayout.cols})를 초과했습니다!
          </div>
        )}

        {data.servers.map((server, idx) => (
          <div key={idx} className="server-card">
            <div className="server-header">
              <span>
                {SERVER_TYPES.find(t => t.value === server.type)?.icon || '🖥'} 
                {' '}Server {idx + 1}: {server.name || '(이름 없음)'}
              </span>
              <button type="button" onClick={() => removeServer(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="server-inputs">
              {/* ID & Type */}
              <div className="input-row-2">
                <div className="input-group">
                  <label>서버 ID *</label>
                  <input
                    type="text"
                    placeholder="예: web_server_1"
                    value={server.id}
                    onChange={e => updateServer(idx, 'id', e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>서버 타입 *</label>
                  <select
                    value={server.type}
                    onChange={e => updateServer(idx, 'type', e.target.value as ServerType)}
                    required
                  >
                    {SERVER_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Name */}
              <div className="input-group">
                <label>서버 이름 *</label>
                <input
                  type="text"
                  placeholder="예: Corporate Web Server"
                  value={server.name}
                  onChange={e => updateServer(idx, 'name', e.target.value)}
                  required
                />
              </div>

              {/* Vulnerability */}
              <div className="input-group">
                <label>취약점 *</label>
                <input
                  type="text"
                  placeholder="예: SQL Injection, Weak Password"
                  value={server.vulnerability}
                  onChange={e => updateServer(idx, 'vulnerability', e.target.value)}
                  required
                />
                <small>이 서버를 해킹하는 방법</small>
              </div>

              {/* Capture Time & Points */}
              <div className="input-row-2">
                <div className="input-group">
                  <label>점령 시간 (초) *</label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    placeholder="10"
                    value={server.captureTime}
                    onChange={e => updateServer(idx, 'captureTime', Number(e.target.value))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>획득 점수 *</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="10"
                    value={server.points}
                    onChange={e => updateServer(idx, 'points', Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              {/* Special Ability */}
              <div className="input-group">
                <label>특수 능력 *</label>
                <input
                  type="text"
                  placeholder="예: DDoS 다른 서버, 데이터 탈취"
                  value={server.specialAbility}
                  onChange={e => updateServer(idx, 'specialAbility', e.target.value)}
                  required
                />
                <small>점령 후 사용할 수 있는 특별한 능력</small>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CaptureServerForm;