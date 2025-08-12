import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createArena } from '../../api/axiosArena';
import '../../assets/scss/arena/AddArenaForm.scss';

// 나중에 difficulty 추가 가능
const AddArenaForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    category: 'Web',
    maxParticipants: 2,
    duration: 10,
  });
  const [error, setError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'maxParticipants' || name === 'duration' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const arena = await createArena(formData);
      navigate(`/arena/${arena._id}`);
    } catch (err: any) {
      console.error(err);
      const msg = err?.msg || 'Failed to create arena';
      alert(msg);
      setError(msg);
    }
  };

  return (
    <div className="arena-form-frame cyber">
      <div className="wizard-shell">
        {/* 왼쪽 사이드 레일 */}
        <aside className="side-rail" aria-label="Wizard steps">
          <div className="rail-title">TABLE OF CONTENTS</div>
          <ol className="rail-steps">
            <li className="done">방 제목 설정</li>
            <li className="done">최대 참가 인원 설정</li>
            <li className="current">제한 시간 설정</li>
            <li>문제 머신의 카테고리 설정</li>
          </ol>
        </aside>

        {/* 메인 네온 패널 */}
        <section className="neon-panel">
          <h2 className="panel-title">CREATE ROOM</h2>

          {/* 진행 표시 스텝퍼 */}
          <div className="stepper" aria-hidden="true">
            <span className="node done" />
            <span className="bar done" />
            <span className="node done" />
            <span className="bar" />
            <span className="node current" />
            <span className="bar" />
            <span className="node" />
          </div>

          {/* 폼 */}
          <form className="add-arena-form" onSubmit={handleSubmit} noValidate>
            <div className="field-card">
              <label htmlFor="name">ROOM NAME</label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Room Name"
                required
              />
            </div>

            <div className="field-card">
              <label htmlFor="maxParticipants">MAX PLAYERS</label>
              <input
                id="maxParticipants"
                type="number"
                name="maxParticipants"
                value={formData.maxParticipants}
                onChange={handleChange}
                min={2}
                max={4}
              />
            </div>

            <div className="field-card">
              <label htmlFor="duration">DURATION (minutes)</label>
              <input
                id="duration"
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                min={10}
                max={60}
                step={5}
              />
            </div>

            <div className="field-card">
              <label htmlFor="category">CATEGORY</label>
              <select id="category" name="category" value={formData.category} onChange={handleChange}>
                {['Web', 'Network', 'Crypto', 'OS', 'Database', 'Cloud', 'AI', 'Random'].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {!!error && <div className="form-error">{error}</div>}

            <button type="submit" className="cta">CREATE</button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default AddArenaForm;