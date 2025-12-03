import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getInventory, useInventoryItem } from '../../api/axiosShop';
import { usePlayContext } from '../../contexts/PlayContext';
import '../../assets/scss/inventory/InventoryModal.scss';

interface InventoryItemData {
  _id: string;
  item: {
    _id: string;
    name: string | { ko: string; en: string };
    description: string | { ko: string; en: string };
    type: string;
    icon?: string;
    imageUrl?: string;
    effect?: {
      hintCount?: number;
      freezeSeconds?: number;
      scoreBoost?: number;
      invincibleSeconds?: number;
    };
  };
  quantity: number;
}

interface InventoryModalProps {
  onClose: () => void;
  isInGame?: boolean; // 게임 중인지 여부
  socket?: any; // Arena 전용: 소켓 인스턴스
  arenaId?: string; // Arena 전용: 아레나 ID
  userId?: string; // Arena 전용: 유저 ID
  gameMode?: string; // 현재 게임 모드 (TERMINAL_HACKING_RACE, VULNERABILITY_SCANNER_RACE 등)
  isGameCompleted?: boolean; // 게임 완료 여부 (완료 시 아이템 사용 불가)
}

const InventoryModal: React.FC<InventoryModalProps> = ({ onClose, isInGame = false, socket, arenaId, userId, gameMode, isGameCompleted = false }) => {
  const [items, setItems] = useState<InventoryItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [using, setUsing] = useState<string | null>(null);

  const { addBuff, setAvailableHints, setIsTimeFrozen } = usePlayContext();

  // 다국어 텍스트 처리 헬퍼
  const getText = (value: string | { ko: string; en: string }): string => {
    if (typeof value === 'string') return value;
    return value.ko || value.en || '';
  };

  // 아이콘이 이미지 URL인지 이모지인지 확인
  const isImageUrl = (icon?: string): boolean => {
    if (!icon) return false;
    return icon.startsWith('/') || icon.startsWith('http');
  };

  // 🎮 게임 모드별로 사용 가능한 효과 정의
  const isItemUsableInMode = (itemEffect: InventoryItemData['item']['effect']): boolean => {
    if (!gameMode || !isInGame) return true; // 게임 외에서는 모든 아이템 표시

    // 각 게임 모드별 사용 가능한 효과
    const modeEffects: Record<string, string[]> = {
      'TERMINAL_HACKING_RACE': ['freezeSeconds', 'scoreBoost'],
      'VULNERABILITY_SCANNER_RACE': ['hintCount', 'scoreBoost', 'invincibleSeconds', 'freezeSeconds'],
      'FORENSICS_RUSH': ['hintCount', 'freezeSeconds', 'invincibleSeconds', 'scoreBoost'],
    };

    const allowedEffects = modeEffects[gameMode] || [];

    // 아이템의 효과 중 하나라도 현재 모드에서 사용 가능하면 true
    if (!itemEffect) return false;

    return !!(
      (itemEffect.hintCount && allowedEffects.includes('hintCount')) ||
      (itemEffect.freezeSeconds && allowedEffects.includes('freezeSeconds')) ||
      (itemEffect.scoreBoost && allowedEffects.includes('scoreBoost')) ||
      (itemEffect.invincibleSeconds && allowedEffects.includes('invincibleSeconds'))
    );
  };

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const data = await getInventory();
        // 🎮 게임 모드에 따라 아이템 필터링
        const filteredData = gameMode && isInGame
          ? data.filter(invItem => isItemUsableInMode((invItem.item as any).effect))
          : data;
        setItems(filteredData as InventoryItemData[]);
      } catch (err) {
        toast.error('인벤토리를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, [gameMode, isInGame]);

  const handleUseItem = async (invId: string, itemData: InventoryItemData) => {
    setUsing(invId);

    try {
      const result = await useInventoryItem(invId);

      // 아이템 효과 적용
      const effect = itemData.item.effect;

      if (effect?.hintCount) {
        setAvailableHints(prev => prev + (effect.hintCount || 0));
        toast.success(`💡 힌트 ${effect.hintCount}개를 획득했습니다!`);
      }

      if (effect?.freezeSeconds) {
        // Arena 모드에서는 서버에 소켓 이벤트 전송
        if (socket && arenaId && userId) {
          socket.emit('arena:use-item', {
            arenaId,
            itemType: 'time_extension',  // ✅ time_freeze -> time_extension (서버 아이템 타입과 일치)
            value: effect.freezeSeconds
          });
          toast.success(`⏰ ${effect.freezeSeconds}초 동안 시간이 연장됩니다!`);
        } else {
          // Machine/Contest 모드에서는 로컬 시간 연장 (기존 로직)
          setIsTimeFrozen(true);
          addBuff({ type: 'time_freeze', value: effect.freezeSeconds, expiresAt: Date.now() + effect.freezeSeconds * 1000 });
          toast.success(`⏰ ${effect.freezeSeconds}초 동안 시간이 연장됩니다!`);

          // 시간 연장 해제
          setTimeout(() => {
            setIsTimeFrozen(false);
          }, effect.freezeSeconds * 1000);
        }
      }

      if (effect?.scoreBoost) {
        // Arena 모드에서는 서버에 소켓 이벤트 전송
        if (socket && arenaId && userId) {
          socket.emit('arena:use-item', {
            arenaId,
            itemType: 'score_boost',
            value: effect.scoreBoost,
            duration: 120 // 기본 2분
          });
          toast.success(`🚀 점수 ${effect.scoreBoost}% 증가 효과 적용! (2분)`);
        } else {
          // Machine/Contest 모드에서는 로컬 처리
          addBuff({ type: 'score_boost', value: effect.scoreBoost });
          toast.success(`🚀 점수 ${effect.scoreBoost}% 증가 효과 적용!`);
        }
      }

      if (effect?.invincibleSeconds) {
        // Arena 모드에서는 서버에 소켓 이벤트 전송
        if (socket && arenaId && userId) {
          socket.emit('arena:use-item', {
            arenaId,
            itemType: 'invincible',
            value: effect.invincibleSeconds
          });
          toast.success(`🛡️ ${effect.invincibleSeconds}초 동안 무적 상태!`);
        } else {
          // Machine/Contest 모드에서는 로컬 처리
          addBuff({ type: 'invincible', value: effect.invincibleSeconds, expiresAt: Date.now() + effect.invincibleSeconds * 1000 });
          toast.success(`🛡️ ${effect.invincibleSeconds}초 동안 무적 상태!`);
        }
      }

      // UI 업데이트
      setItems(prev => prev.map(item => {
        if (item._id === invId) {
          const newQuantity = result.remainingQuantity;
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
        }
        return item;
      }).filter(Boolean) as InventoryItemData[]);

    } catch (err: any) {
      toast.error(err?.response?.data?.msg ?? '아이템 사용에 실패했습니다.');
    } finally {
      setUsing(null);
    }
  };

  return (
    <div className="inventory-overlay">
      <div className="inventory-modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>INVENTORY</h2>

        {loading ? (
          <p className="loading">Loading...</p>
        ) : items.length === 0 ? (
          <p className="empty">보유한 아이템이 없습니다.</p>
        ) : (
          <div className="inventory-list">
            {items.map((invItem) => {
              // 이미지 URL 결정 (imageUrl 또는 icon이 URL인 경우)
              const imgUrl = invItem.item.imageUrl || (isImageUrl(invItem.item.icon) ? invItem.item.icon : null);
              // 이모지 아이콘 (icon이 URL이 아닌 경우만)
              const emojiIcon = invItem.item.icon && !isImageUrl(invItem.item.icon) ? invItem.item.icon : '';

              return (
                <div key={invItem._id} className="inventory-item">
                  {imgUrl && (
                    <img
                      src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5001'}${imgUrl}`}
                      alt={getText(invItem.item.name)}
                      style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }}
                    />
                  )}
                  <div className="item-info">
                    <h3>{emojiIcon} {getText(invItem.item.name)}</h3>
                    <p>{getText(invItem.item.description)}</p>
                    <span>보유: {invItem.quantity}개</span>

                  {isInGame && (
                    <button
                      className="use-btn"
                      onClick={() => handleUseItem(invItem._id, invItem)}
                      disabled={using === invItem._id || isGameCompleted}
                      style={{
                        marginTop: 8,
                        padding: '6px 12px',
                        background: isGameCompleted ? '#666' : '#00f5ff',
                        border: 'none',
                        borderRadius: 4,
                        color: isGameCompleted ? '#999' : '#000',
                        fontWeight: 600,
                        cursor: isGameCompleted ? 'not-allowed' : 'pointer',
                        opacity: isGameCompleted ? 0.6 : 1,
                      }}
                    >
                      {using === invItem._id ? '사용 중...' : isGameCompleted ? '완료됨' : '사용하기'}
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryModal;