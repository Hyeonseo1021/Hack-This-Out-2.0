import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';

interface ServerData {
  id: string;
  name: string;
  captureTime: number;
  points: number;
}

interface CaptureServerData {
  totalServers: number;
  servers: ServerData[];
}

interface Props {
  data: CaptureServerData;
  onChange: (data: CaptureServerData) => void;
}

const CaptureServerForm: React.FC<Props> = ({ data, onChange }) => {
  
  const addServer = () => {
    const newId = `server${data.servers.length + 1}`;
    onChange({
      ...data,
      totalServers: data.servers.length + 1,
      servers: [
        ...data.servers,
        { id: newId, name: '', captureTime: 30, points: 10 }
      ]
    });
  };

  const removeServer = (index: number) => {
    onChange({
      ...data,
      totalServers: data.servers.length - 1,
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

  return (
    <div>
      <h3 style={{ color: '#00d4ff', marginBottom: '15px' }}>Capture The Server Settings</h3>

      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ fontSize: '11px', opacity: 0.7 }}>Servers ({data.servers.length})</label>
          <button type="button" onClick={addServer} style={{ padding: '4px 8px', fontSize: '11px' }}>
            <FaPlus /> Add Server
          </button>
        </div>

        {data.servers.map((server, idx) => (
          <div key={idx} style={{ 
            background: '#16213e', 
            padding: '10px', 
            borderRadius: '4px', 
            marginBottom: '8px',
            border: '1px solid #2d2d44'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#999' }}>Server {idx + 1}</span>
              <button 
                type="button" 
                onClick={() => removeServer(idx)}
                style={{ padding: '2px 6px', fontSize: '10px' }}
              >
                <FaTrash />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '8px' }}>
              <input
                type="text"
                placeholder="ID"
                value={server.id}
                onChange={e => updateServer(idx, 'id', e.target.value)}
                required
              />
              
              <input
                type="text"
                placeholder="Server name (e.g., Web Server)"
                value={server.name}
                onChange={e => updateServer(idx, 'name', e.target.value)}
                required
              />

              <input
                type="number"
                placeholder="Capture time (s)"
                min={10}
                max={300}
                value={server.captureTime}
                onChange={e => updateServer(idx, 'captureTime', Number(e.target.value))}
              />

              <input
                type="number"
                placeholder="Points"
                min={1}
                value={server.points}
                onChange={e => updateServer(idx, 'points', Number(e.target.value))}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CaptureServerForm;