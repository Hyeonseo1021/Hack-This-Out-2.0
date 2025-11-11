import React from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import '../../../assets/scss/admin/CaptureServerForm.scss';

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
    <div className="capture-server-form">
      <h3>Capture The Server Settings</h3>

      <div>
        <div className="section-header">
          <label>Servers ({data.servers.length})</label>
          <button type="button" onClick={addServer}>
            <FaPlus /> Add Server
          </button>
        </div>

        {data.servers.map((server, idx) => (
          <div key={idx} className="server-card">
            <div className="server-header">
              <span>Server {idx + 1}</span>
              <button type="button" onClick={() => removeServer(idx)}>
                <FaTrash />
              </button>
            </div>

            <div className="server-inputs">
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