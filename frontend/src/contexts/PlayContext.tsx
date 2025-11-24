import React, { createContext, useState, ReactNode, useContext } from 'react';

interface ActiveBuff {
  type: 'hint' | 'time_freeze' | 'score_boost' | 'invincible';
  value: number;
  expiresAt?: number; // timestamp for time-limited buffs
}

interface PlayContextProps {
  downloadStatus: 'idle' | 'inProgress' | 'completed';
  setDownloadStatus: React.Dispatch<React.SetStateAction<'idle' | 'inProgress' | 'completed'>>;
  instanceStatus: 'pending' | 'running' | 'terminated' | null;
  setInstanceStatus: React.Dispatch<React.SetStateAction<'pending' | 'running' | 'terminated' | null>>;
  submitStatus: 'flag' | 'flag-success';
  setSubmitStatus: React.Dispatch<React.SetStateAction<'flag' | 'flag-success'>>;

  // 아이템/버프 시스템
  activeBuffs: ActiveBuff[];
  addBuff: (buff: ActiveBuff) => void;
  removeBuff: (type: string) => void;
  clearBuffs: () => void;
  hasActiveBuff: (type: string) => boolean;
  getBuffValue: (type: string) => number;

  // 힌트 카운트
  availableHints: number;
  setAvailableHints: React.Dispatch<React.SetStateAction<number>>;
  useHint: () => void;

  // 시간 정지
  isTimeFrozen: boolean;
  setIsTimeFrozen: React.Dispatch<React.SetStateAction<boolean>>;
}

const PlayContext = createContext<PlayContextProps | undefined>(undefined);

export const PlayProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'inProgress' | 'completed'>('idle');
  const [instanceStatus, setInstanceStatus] = useState<'pending' | 'running' | 'terminated' | null>(null);
  const [submitStatus, setSubmitStatus] = useState<'flag' | 'flag-success'>('flag');

  const [activeBuffs, setActiveBuffs] = useState<ActiveBuff[]>([]);
  const [availableHints, setAvailableHints] = useState<number>(0);
  const [isTimeFrozen, setIsTimeFrozen] = useState<boolean>(false);

  const addBuff = (buff: ActiveBuff) => {
    setActiveBuffs(prev => {
      // 같은 타입이 있으면 교체, 없으면 추가
      const filtered = prev.filter(b => b.type !== buff.type);
      return [...filtered, buff];
    });
  };

  const removeBuff = (type: string) => {
    setActiveBuffs(prev => prev.filter(b => b.type !== type));
  };

  const clearBuffs = () => {
    setActiveBuffs([]);
    setAvailableHints(0);
    setIsTimeFrozen(false);
  };

  const hasActiveBuff = (type: string): boolean => {
    return activeBuffs.some(b => b.type === type);
  };

  const getBuffValue = (type: string): number => {
    const buff = activeBuffs.find(b => b.type === type);
    return buff ? buff.value : 0;
  };

  const useHint = () => {
    if (availableHints > 0) {
      setAvailableHints(prev => prev - 1);
    }
  };

  return (
    <PlayContext.Provider
      value={{
        downloadStatus,
        setDownloadStatus,
        instanceStatus,
        setInstanceStatus,
        submitStatus,
        setSubmitStatus,
        activeBuffs,
        addBuff,
        removeBuff,
        clearBuffs,
        hasActiveBuff,
        getBuffValue,
        availableHints,
        setAvailableHints,
        useHint,
        isTimeFrozen,
        setIsTimeFrozen,
      }}
    >
      {children}
    </PlayContext.Provider>
  );
};

export const usePlayContext = (): PlayContextProps => {
  const context = useContext(PlayContext);
  if (!context) {
    throw new Error('usePlayContext must be used within a PlayProvider');
  }
  return context;
};