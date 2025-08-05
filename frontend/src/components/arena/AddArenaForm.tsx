import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createArena } from '../../api/axiosArena';
import '../../assets/scss/arena/AddArenaForm.scss';

//나중에 difficulty추가
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
      alert(err?.msg || 'Failed to create arena');
      setError(err?.msg || 'Failed to create arena');
    }
  };


  return (
    <div className="arena-form-frame">
      <form className="add-arena-form" onSubmit={handleSubmit}>
        <div className='title'>CREATE ARENA</div>

        <label>ROOM NAME</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter room name"
          required
        />

        <label>CATEGORY</label>
        <select name="category" value={formData.category} onChange={handleChange}>
          {['Web', 'Network', 'Crypto', 'OS', 'Database', 'Cloud', 'AI', 'Random'].map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <label>MAX PARTICIPANTS</label>
        <input
          type="number"
          name="maxParticipants"
          value={formData.maxParticipants}
          onChange={handleChange}
          min={2}
          max={4}
        />

        <label>DURATION (minutes)</label>
        <input
          type="number"
          name="duration"
          value={formData.duration}
          onChange={handleChange}
          min={10}
          max={60}
        />

        <button type="submit">CREATE ARENA</button>
      </form>
    </div>
  );
};

export default AddArenaForm;
