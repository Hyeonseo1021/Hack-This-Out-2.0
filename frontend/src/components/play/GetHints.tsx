import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getUsedHintsInContest, getHintInContest } from '../../api/axiosContest';
import { getUsedHints, getMachineHints } from '../../api/axiosMachine';
import { getInventory, useInventoryItem } from '../../api/axiosShop';
import LoadingIcon from '../public/LoadingIcon';
import '../../assets/scss/play/GetHints.scss';
import { FaRegQuestionCircle } from "react-icons/fa";
import { CiLock } from "react-icons/ci";
import { usePlayContext } from '../../contexts/PlayContext';
/**
 * Props interface for GetHints component.
 */
interface GetHintsProps {
  machineId: string;
  playType: 'machine' | 'contest';
  contestId?: string; // Optional, required only for contest mode
  disabled?: boolean; // Optional, to disable the component
  requiresHintItem?: boolean; // Optional, 힌트권 필요 여부 (기본: false=무료)
}

/**
 * Interface representing the hint data.
 */
interface Hint {
  content: string;
}

/**
 * Interface representing an error message.
 */
interface ErrorMessage {
  msg: string;
}

/**
 * Interface representing hint item from inventory.
 */
interface HintInventoryItem {
  _id: string;
  item: {
    _id: string;
    name: string | { ko: string; en: string };
    effect?: {
      hintCount?: number;
    };
  };
  quantity: number;
}

/**
 * Component to fetch and display hints for a machine or contest.
 */
const GetHints: React.FC<GetHintsProps> = ({ machineId, playType, contestId, requiresHintItem = false }) => {
  const [hints, setHints] = useState<Hint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ErrorMessage | null>(null);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [remainingHints, setRemainingHints] = useState<number>(0);

  // 힌트 아이템 관련 상태
  const [hintItems, setHintItems] = useState<HintInventoryItem[]>([]);
  const [usingItem, setUsingItem] = useState<boolean>(false);

  const { instanceStatus, availableHints, useHint, setAvailableHints } = usePlayContext();
  const disabled = instanceStatus !== 'running';

  /**
   * Fetch used hints and progress for contest mode.
   */
  const fetchUsedHintsInContestMode = async () => {
    try {
      if (!contestId) {
        throw new Error('Contest ID is missing.');
      }

      const response = await getUsedHintsInContest(contestId, machineId);

      if (response && response.usedHints) {
        setHints(response.usedHints.map((hintContent: string) => ({ content: hintContent })));
        setHintsUsed(response.hintsUsed);
        setRemainingHints(response.remainingHints);
      } else {
        setHints([]);
        setHintsUsed(0);
        setRemainingHints(0);
      }
    } catch (err: any) {
      console.error('Error fetching used hints in contest:', err);
      setError({ msg: err.message || 'Failed to fetch used hints in contest.' });
    }
  };

  /**
   * Fetch used hints and progress for machine mode.
   */
  const fetchUsedHintsMachineMode = async () => {
    try {
      const response = await getUsedHints(machineId);

      if (response && response.usedHints) {
        setHints(response.usedHints.map((hintContent: string) => ({ content: hintContent })));
        setHintsUsed(response.hintsUsed);
        setRemainingHints(response.remainingHints);
      } else {
        setHints([]);
        setHintsUsed(0);
        setRemainingHints(0);
      }
    } catch (err: any) {
      console.error('Error fetching used hints:', err);
      setError({ msg: 'Failed to fetch used hints.' });
    }
  };

  /**
   * Fetch a single hint based on play type and append it to the hints list.
   * 🔒 힌트권 시스템: requiresHintItem이 true면 힌트권 필요, false면 무료
   */
  const fetchHint = async () => {
    // ⭐ 힌트권 체크 (requiresHintItem이 true일 때만)
    if (requiresHintItem && availableHints <= 0) {
      setError({ msg: '힌트권이 필요합니다! 인벤토리에서 힌트권을 사용하세요.' });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let response;
      if (playType === 'machine') {
        response = await getMachineHints(machineId);
      } else if (playType === 'contest') {
        if (!contestId) {
          throw new Error('Contest ID is missing for contest mode.');
        }
        response = await getHintInContest(contestId, machineId);
      }

      if (response?.hint) {
        setHints(prevHints => [...prevHints, { content: response.hint }]);
        setHintsUsed(response.hintsUsed);
        setRemainingHints(response.remainingHints);

        // ⭐ 힌트권 사용 (requiresHintItem이 true일 때만)
        if (requiresHintItem) {
          useHint();
        }
      } else {
        throw new Error('Invalid response from server.');
      }
    } catch (err: any) {
      console.error('Error fetching hint:', err);
      setError({ msg: err.msg || 'Failed to fetch hint.' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch hint items from inventory (only for machine mode with requiresHintItem)
   */
  const fetchHintItems = async () => {
    try {
      const inventory = await getInventory();
      // 힌트 아이템만 필터링 (effect.hintCount가 있는 아이템)
      const hintOnlyItems = inventory.filter(
        (invItem: any) => invItem.item?.effect?.hintCount && invItem.item.effect.hintCount > 0
      ) as HintInventoryItem[];
      setHintItems(hintOnlyItems);
    } catch (err) {
      console.error('Error fetching hint items:', err);
    }
  };

  /**
   * Use a hint item from inventory
   */
  const handleUseHintItem = async (invItem: HintInventoryItem) => {
    setUsingItem(true);
    try {
      const result = await useInventoryItem(invItem._id);
      const hintCount = invItem.item.effect?.hintCount || 0;

      // 힌트 사용 가능 횟수 증가
      setAvailableHints(prev => prev + hintCount);
      toast.success(`힌트권 ${hintCount}개를 사용했습니다!`);

      // 인벤토리 업데이트
      setHintItems(prev => prev.map(item => {
        if (item._id === invItem._id) {
          const newQuantity = result.remainingQuantity;
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
        }
        return item;
      }).filter(Boolean) as HintInventoryItem[]);

    } catch (err: any) {
      toast.error(err?.response?.data?.msg ?? '힌트권 사용에 실패했습니다.');
    } finally {
      setUsingItem(false);
    }
  };

  /**
   * Fetch used hints on component mount or when machine/playType changes.
   */
  useEffect(() => {
    if (playType === 'contest') {
      fetchUsedHintsInContestMode();
    } else if (playType === 'machine') {
      fetchUsedHintsMachineMode();
      // 힌트권이 필요한 경우 인벤토리에서 힌트 아이템 로드
      if (requiresHintItem) {
        fetchHintItems();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId, playType, contestId, requiresHintItem]);

  return (
    <div className="get-hints-container">
      <div className="upper-text">
        <FaRegQuestionCircle size={40} color="white" />
        {remainingHints > 0 ? <h2>Hints</h2> : <h2>No More Hints</h2>}
      </div>
      <div className="lower-text">
        {!requiresHintItem ? (
          <h3>힌트를 무료로 사용할 수 있습니다</h3>
        ) : availableHints > 0 ? (
          <h3>힌트권 {availableHints}개 보유 중 - 버튼을 눌러 힌트 확인</h3>
        ) : remainingHints > 0 ? (
          <h3>힌트권이 필요합니다! 아래에서 힌트권을 사용하세요.</h3>
        ) : (
          <h3>You have used all the hints for this machine.</h3>
        )}
      </div>

      {/* 힌트권 사용 섹션 (requiresHintItem이 true이고 힌트 아이템이 있을 때만 표시) */}
      {requiresHintItem && hintItems.length > 0 && !disabled && remainingHints > 0 && (
        <div className="hint-items-section">
          <h4>보유 힌트권</h4>
          <div className="hint-items-list">
            {hintItems.map((invItem) => {
              const itemName = typeof invItem.item.name === 'string'
                ? invItem.item.name
                : invItem.item.name.ko || invItem.item.name.en;
              return (
                <div key={invItem._id} className="hint-item">
                  <span className="hint-item-name">{itemName}</span>
                  <span className="hint-item-qty">x{invItem.quantity}</span>
                  <button
                    className="hint-item-use-btn"
                    onClick={() => handleUseHintItem(invItem)}
                    disabled={usingItem}
                  >
                    {usingItem ? '...' : '사용'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {loading && <LoadingIcon />}
      {error && <div className="error-message">{error.msg}</div>}
      {!loading && !error && hintsUsed > 0 && (
        <div className="used-hints">
          <ul className="hints-list">
            {hints.map((hint, index) => (
              <li
                className="list hint-animate"
                key={index}
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                {hint.content}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={fetchHint}
        disabled={loading || remainingHints === 0 || disabled || (requiresHintItem && availableHints === 0)}
        className={`get-hints-button ${disabled || remainingHints === 0 || (requiresHintItem && availableHints === 0) ? "disabled" : ""}`}
      >
        {loading ? (
          <LoadingIcon />
        ) : disabled || remainingHints === 0 ? (
          <CiLock size={40} color="#ccc" />
        ) : requiresHintItem && availableHints === 0 ? (
          <>
            <CiLock size={40} color="#ccc" />
            <span style={{ marginLeft: 8 }}>힌트권 필요</span>
          </>
        ) : (
          'Hint'
        )}
        {!disabled && remainingHints > 0 && requiresHintItem && availableHints > 0 && ` (보유: ${availableHints})`}
      </button>
    </div>
  );
};

export default GetHints;