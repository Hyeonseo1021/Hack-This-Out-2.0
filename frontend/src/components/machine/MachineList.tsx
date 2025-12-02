import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getActiveMachines } from '../../api/axiosMachine';
import styles from '../../assets/scss/machine/MachineList.module.scss';
import { useNavigate } from 'react-router-dom';
import Rating from '@mui/material/Rating';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import { getAvatarColorIndex, avatarBackgroundColors } from '../../utils/avatars';
import LoadingIcon from '../public/LoadingIcon';
import ErrorIcon from '../public/ErrorIcon';
import CatIcon from '../../assets/img/icon/Hack_cat.png';


interface Machine {
  _id: string;
  name: string;
  category: string;
  rating: number;
  playerCount: number;
  description?: string;
  reviews?: string[];
  difficulty?: {
    creatorLevel: string;
    confirmedLevel?: string;
    isConfirmed: boolean;
  };
}

interface MachinesResponse {
  machines: Machine[];
  msg?: string;
}

const MachineList: React.FC = () => {
  const { t } = useTranslation('machine');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [filteredMachines, setFilteredMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [openRow, setOpenRow] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [filterVisible, setFilterVisible] = useState<boolean>(false);

  const navigate = useNavigate();

  const categories = ['Web', 'Network', 'Database', 'Crypto', 'Cloud', 'AI', 'OS', 'Other'];

  const toggleAccordion = (id: string) => {
    setOpenRow(prev => (prev === id ? null : id));
  };

  const getDifficultyColor = (level: string): string => {
    const colors: { [key: string]: string } = {
      'very_easy': '#4ade80',
      'easy': '#86efac',
      'medium': '#fbbf24',
      'hard': '#fb923c',
      'very_hard': '#ef4444',
    };
    return colors[level] || '#94a3b8';
  };

  const getDifficultyLabel = (level: string): string => {
    return t(`difficulty_short.${level}`, 'N/A');
  };

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const data: MachinesResponse = await getActiveMachines();
        setMachines(data.machines);
        setFilteredMachines(data.machines);
      } catch (err: any) {
        setError(err.msg || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMachines();
  }, []);

  useEffect(() => {
    if (categoryFilter === '') {
      setFilteredMachines(machines);
    } else {
      setFilteredMachines(machines.filter(m => m.category === categoryFilter));
    }
  }, [categoryFilter, machines]);

  const handleMachineClick = (machine: Machine) => {
    navigate(`/machine/${machine._id}`);
  };

  if (loading) return <LoadingIcon />;
  if (error) return <ErrorIcon />;

  return (
    <div className={styles.machine_list_container}>
      <div className={styles.machine_list_title}>{t('title')}</div>

      <table className={styles.machine_list_table}>
        <thead>
          <tr className={styles.table_text_box}>
            <th className={styles.table_name}>{t('name')}</th>

            <th className={styles.table_category}>
              {t('details.category')}
              <ClickAwayListener onClickAway={() => setFilterVisible(false)}>
                <div className={styles.category_filter_toggle}>
                  <FilterAltIcon
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilterVisible(prev => !prev);
                    }}
                    sx={{ fontSize: 'clamp(20px, 2.5vw, 24px)', cursor: 'pointer' }}
                  />

                  {filterVisible && (
                    <div className={styles.category_filter}>
                      <select
                        className={styles.category_select}
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                      >
                        <option value="">{t('filter.all')}</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </ClickAwayListener>
            </th>

            <th className={styles.table_difficulty}>{t('difficulty')}</th>
            <th className={styles.table_rating}>{t('rating')}</th>
            <th className={styles.table_playCount}>{t('played')}</th>
            <th className={styles.table_details}>{t('detail')}</th>
          </tr>
        </thead>

        <tbody>
          {filteredMachines.map((machine) => {
            const avatarColorIndex = getAvatarColorIndex(machine.name);
            const avatarBgColor = avatarBackgroundColors[avatarColorIndex];
            const difficulty = machine.difficulty?.confirmedLevel || machine.difficulty?.creatorLevel;

            return (
              <React.Fragment key={machine._id}>

                {/* ▶ 기본 행 */}
                <tr className={styles.machine_box}>
                  <td className={styles.machine_name}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Avatar
                        variant="rounded"
                        sx={{
                          backgroundColor: avatarBgColor,
                          width: '40px',
                          height: '40px',
                          fontSize: '16px',
                        }}
                      >
                          <img
                            src={CatIcon}
                            alt="cat"
                            style={{
                            width: '70%',          // 네모박스 안에 자연스럽게 들어오게 조절
                            height: '70%',
                            objectFit: 'contain',
                          }}
                       />
                      </Avatar>
                      <span>{machine.name}</span>
                    </Box>
                  </td>

                  <td className={styles.machine_category}>{machine.category}</td>

                  <td className={styles.machine_difficulty}>
                    {difficulty && (
                      <span
                        style={{
                          backgroundColor: getDifficultyColor(difficulty),
                          padding: '4px 8px',
                          borderRadius: '8px',
                          fontWeight: 'bold'
                        }}
                      >
                        {getDifficultyLabel(difficulty)}
                      </span>
                    )}
                  </td>

                  <td className={styles.machine_rating}>
                    <Rating value={machine.rating} precision={0.5} readOnly />
                  </td>

                  <td className={styles.machine_playCount}>{machine.playerCount}</td>

                  {/* 🔥 GO 버튼 + +/– 버튼 */}
                  <td className={styles.machine_details}>
                    <div className={styles.detail_buttons_wrapper}>

                      {/* GO! 버튼 */}
                      <button
                        className={styles.go_button}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMachineClick(machine);
                        }}
                      >
                        {t('go')}
                      </button>

                      {/* 아코디언 토글 */}
                      <button
                        className={styles.toggle_button}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAccordion(machine._id);
                        }}
                      >
                        {openRow === machine._id ? '▲' : '▼'}
                      </button>

                    </div>
                  </td>
                </tr>

                {/* ▼ 아코디언 */}
                {openRow === machine._id && (
                  <tr className={styles.machine_expand_row}>
                    <td colSpan={6}>
                      <div className={styles.expand_content}>
                        <p className={styles.expand_description}>
                          {machine.description || t('noDescription')}
                        </p>

                        <div className={styles.expand_reviews}>
                          {machine.reviews?.map((r, i) => (
                            <p key={i}>{r}</p>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MachineList;