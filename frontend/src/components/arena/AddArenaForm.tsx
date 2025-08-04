import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createArena } from '../../api/axiosArena';
import '../../assets/scss/arena/AddArenaForm.scss';

const AddArenaForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    category: 'Web',
    difficulty: 'Easy',
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
      setError(err?.msg || 'Failed to create arena');
    }
  };


  return (
    <div className="arena-form-frame">
      <form className="add-arena-form" onSubmit={handleSubmit}>
        <h2>Create Arena</h2>

        <label>Room Name *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter room name"
          required
        />

        <label>Category *</label>
        <select name="category" value={formData.category} onChange={handleChange}>
          {['Web', 'Network', 'Crypto', 'OS', 'Database', 'Cloud', 'AI', 'Random'].map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <label>Difficulty *</label>
        <select name="difficulty" value={formData.difficulty} onChange={handleChange}>
          {['Easy', 'Medium', 'Hard', 'Random'].map(diff => (
            <option key={diff} value={diff}>{diff}</option>
          ))}
        </select>

        <label>Max Participants *</label>
        <input
          type="number"
          name="maxParticipants"
          value={formData.maxParticipants}
          onChange={handleChange}
          min={2}
          max={4}
        />

        <label>Duration (minutes) *</label>
        <input
          type="number"
          name="duration"
          value={formData.duration}
          onChange={handleChange}
          min={10}
          max={60}
        />

        {error && <p className="form-error">{error}</p>}

        <button type="submit">Create Arena</button>
      </form>
    </div>
  );
};

export default AddArenaForm;
