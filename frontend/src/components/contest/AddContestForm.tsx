import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createContest } from '../../api/axiosContest';
import { getActiveMachines } from '../../api/axiosMachine';
import { useNavigate } from 'react-router-dom';
import '../../assets/scss/contest/AddContestForm.scss';
import Loading from '../public/Loading';
import { IoMdArrowRoundBack } from "react-icons/io";
import RegisterCompleteMD from '../modal/RegisterCompleteMD';

interface Contest {
    id: string;
    name: string;
    description: string;
    startTime: string;
    endTime: string;
    machines: string[];
    contestExp: number;
}

interface AddContestFormProps {
    onContestAdded: (contest: Contest) => void;
}

interface Machine {
    id: string;
    name: string;
}

interface FormData {
    name: string;
    description: string;
    startTime: string;
    endTime: string;
    machines: Machine[];
    contestExp: number;
}

interface Suggestions {
    [key: number]: Machine[];
}

interface ValidationErrors {
    [key: string]: string;
}

const AddContestForm: React.FC<AddContestFormProps> = ({ onContestAdded }) => {
    const { t } = useTranslation('contest');
    const [formData, setFormData] = useState<FormData>({
        name: '',
        description: '',
        startTime: '',
        endTime: '',
        machines: [{ id: '', name: '' }],
        contestExp: 100,
    });

    const [loading, setLoading] = useState(false);
    const [allMachines, setAllMachines] = useState<Machine[]>([]);
    const [suggestions, setSuggestions] = useState<Suggestions>({});
    const [activeSuggestion, setActiveSuggestion] = useState<Record<number, number>>({});
    const [focusedMachineIndex, setFocusedMachineIndex] = useState<number | null>(null);
    const navigate = useNavigate();
    const [registerComplete, setRegisterComplete] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

    const { name, description, contestExp, startTime, endTime, machines } = formData;

    const adjustTextareaHeight = () => {
        const descriptionRef = document.getElementById('description') as HTMLTextAreaElement | null;
        if (descriptionRef) {
            descriptionRef.style.height = 'auto';
            descriptionRef.style.height = `${descriptionRef.scrollHeight}px`;
        }
    };

    useEffect(() => { adjustTextareaHeight(); }, [description]);

    useEffect(() => {
        const loadMachines = async () => {
            try {
                const data = await getActiveMachines();
                if (Array.isArray(data.machines)) {
                    const machinesList = data.machines.map((m: any) => ({
                        id: m._id,
                        name: m.name,
                    }));
                    setAllMachines(machinesList);
                }
            } catch {
                setAllMachines([]);
            }
        };
        loadMachines();
    }, []);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        index?: number
    ) => {
        const { name, value } = e.target;

        if (name.startsWith('machine-') && typeof index === 'number') {
            const updatedMachines = [...machines];
            updatedMachines[index] = { id: '', name: value };
            setFormData({ ...formData, machines: updatedMachines });

            if (value) {
                const matched = allMachines.filter(machine =>
                    machine.name.toLowerCase().includes(value.toLowerCase())
                );
                setSuggestions(prev => ({ ...prev, [index]: matched }));
            } else {
                setSuggestions(prev => ({ ...prev, [index]: [] }));
            }

            setFocusedMachineIndex(index);
            return;
        }

        setFormData({
            ...formData,
            [name]: name === 'contestExp' ? Number(value) : value,
        });
    };

    const handleFocus = (index: number) => {
        setFocusedMachineIndex(index);

        if (machines[index].name) {
            const matched = allMachines.filter(machine =>
                machine.name.toLowerCase().includes(machines[index].name.toLowerCase())
            );
            setSuggestions(prev => ({ ...prev, [index]: matched }));
        }
    };

    const handleAddMachineField = () => {
        setFormData({
            ...formData,
            machines: [...machines, { id: '', name: '' }],
        });
    };

    const handleDeleteMachineField = (index: number) => {
        const updatedMachines = machines.filter((_, i) => i !== index);
        setFormData({ ...formData, machines: updatedMachines });

        setSuggestions(prev => {
            const updated = { ...prev };
            delete updated[index];
            return updated;
        });

        setActiveSuggestion(prev => {
            const updated = { ...prev };
            delete updated[index];
            return updated;
        });

        setFocusedMachineIndex(null);
    };

    const handleSuggestionClick = (index: number, machine: Machine) => {
        const updatedMachines = [...machines];
        updatedMachines[index] = { id: machine.id, name: machine.name };
        setFormData({ ...formData, machines: updatedMachines });

        setSuggestions(prev => ({ ...prev, [index]: [] }));
        setActiveSuggestion(prev => ({ ...prev, [index]: -1 }));
        setFocusedMachineIndex(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        const list = suggestions[index] || [];

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveSuggestion(prev => ({
                ...prev,
                [index]: (prev[index] ?? -1) + 1,
            }));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveSuggestion(prev => ({
                ...prev,
                [index]: (prev[index] ?? 0) - 1,
            }));
        } else if (e.key === 'Enter') {
            if (activeSuggestion[index] >= 0 && activeSuggestion[index] < list.length) {
                e.preventDefault();
                handleSuggestionClick(index, list[activeSuggestion[index]]);
            }
        } else if (e.key === 'Escape') {
            setSuggestions(prev => ({ ...prev, [index]: [] }));
            setActiveSuggestion(prev => ({ ...prev, [index]: -1 }));
            setFocusedMachineIndex(null);
        }
    };

    const validateForm = (): boolean => {
        const errors: ValidationErrors = {};
        const now = new Date();
        const s = new Date(startTime);
        const e = new Date(endTime);

        if (!name || name.length < 3) errors.name = t('form.errors.nameLength');
        if (!description) errors.description = t('form.errors.descriptionRequired');
        if (!startTime) errors.startTime = t('form.errors.startTimeRequired');
        else if (s < now) errors.startTime = t('form.errors.startTimeInPast');

        if (!endTime) errors.endTime = t('form.errors.endTimeRequired');
        else if (e <= s) errors.endTime = t('form.errors.endTimeAfterStart');
        else if ((e.getTime() - s.getTime()) / 3600000 < 24)
            errors.endTime = t('form.errors.duration24Hours');

        if (machines.some(m => !m.id)) errors.machines = t('form.errors.machinesRequired');
        if (contestExp < 100) errors.contestExp = t('form.errors.expMinimum');

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setLoading(true);
            const machineIds = machines.map(m => m.id);

            const data = await createContest({
                name,
                description,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString(),
                machines: machineIds,
                contestExp,
            });

            if (data.message === 'OK') {
                setRegisterComplete(true);
                onContestAdded(data.contest);
            }
        } catch (err: any) {
            setValidationErrors({ submit: err.message || t('form.errors.submitFailed') });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Loading />;

    return (
        <form onSubmit={handleSubmit} ref={formRef} className="add-contest-form">
            <div className="back-button">
                <button className="IconButton" type="button" onClick={() => navigate(-1)}>
                    <IoMdArrowRoundBack style={{ color: 'white', fontSize: "34px" }} />
                </button>
                <h2>{t('form.title')}</h2>
            </div>

            <div className="create-container">
                <div className="name-container">
                    <label>{t('form.contestName')} *</label>
                    <input
                        type="text"
                        name="name"
                        value={name}
                        onChange={handleChange}
                        className={validationErrors.name ? 'error-input' : ''}
                    />
                    {validationErrors.name && <span className="field-error">{validationErrors.name}</span>}
                </div>

                <div className="description-container">
                    <label>{t('form.description')} *</label>
                    <textarea
                        id="description"
                        name="description"
                        value={description}
                        onChange={handleChange}
                        className={validationErrors.description ? 'error-input' : ''}
                    />
                    {validationErrors.description && (
                        <span className="field-error">{validationErrors.description}</span>
                    )}
                </div>

                <div className="start-time-container">
                    <label>{t('form.startTime')} *</label>
                    <input
                        type="datetime-local"
                        name="startTime"
                        value={startTime}
                        onChange={handleChange}
                        className={validationErrors.startTime ? 'error-input' : ''}
                    />
                </div>

                <div className="end-time-container">
                    <label>{t('form.endTime')} *</label>
                    <input
                        type="datetime-local"
                        name="endTime"
                        value={endTime}
                        onChange={handleChange}
                        className={validationErrors.endTime ? 'error-input' : ''}
                    />
                </div>

                <div className="exp-container">
                    <label>{t('form.reward')} *</label>
                    <input
                        type="number"
                        name="contestExp"
                        value={contestExp}
                        onChange={handleChange}
                    />
                </div>

                <div className="add-machine-container">
                    <label>{t('form.machines')} *</label>

                    {machines.map((machine, index) => (
                        <div key={index} className="machine-field">
                            <input
                                type="text"
                                name={`machine-${index}`}
                                value={machine.name}
                                onChange={(e) => handleChange(e, index)}
                                onFocus={() => handleFocus(index)}
                                onKeyDown={(e) => handleKeyDown(e, index)}
                                placeholder={t('form.machinePlaceholder', { index: index + 1 })}
                                autoComplete="off"
                            />

                            {machines.length > 1 && (
                                <button
                                    type="button"
                                    className="delete-machine"
                                    onClick={() => handleDeleteMachineField(index)}
                                >
                                    {t('form.delete')}
                                </button>
                            )}

                            {focusedMachineIndex === index &&
                                suggestions[index] &&
                                suggestions[index].length > 0 && (
                                    <ul className="suggestions-list">
                                        {suggestions[index].map((suggestion, sIndex) => (
                                            <li
                                                key={sIndex}
                                                className={activeSuggestion[index] === sIndex ? 'active' : ''}
                                                onMouseDown={() => handleSuggestionClick(index, suggestion)}
                                            >
                                                {suggestion.name}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                        </div>
                    ))}

                    <button type="button" className="add-machine-button" onClick={handleAddMachineField}>
                        {t('form.addMachine')}
                    </button>
                </div>

                <div className="add-contest-form-button">
                    <button type="submit">{t('form.submit')}</button>
                </div>
            </div>

            {registerComplete && (
                <RegisterCompleteMD
                    onClose={() => {
                        setRegisterComplete(false);
                        navigate('/contest');
                    }}
                    mode="contest"
                />
            )}
        </form>
    );
};

export default AddContestForm;
