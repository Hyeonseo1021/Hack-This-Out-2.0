import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getInventory, useInventoryItem } from '../../api/axiosShop';
import { usePlayContext } from '../../contexts/PlayContext';
import '../../assets/scss/inventory/InventoryModal.scss';

interface InventoryItemData {
  _id: string;
  item: {
    _id: string;
    name: string;
    description: string;
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
}

const InventoryModal: React.FC<InventoryModalProps> = ({ onClose, isInGame = false, socket, arenaId, userId }) => {
  const [items, setItems] = useState<InventoryItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [using, setUsing] = useState<string | null>(null);

  const { addBuff, setAvailableHints, setIsTimeFrozen } = usePlayContext();

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const data = await getInventory();
        setItems(data);
      } catch (err) {
        toast.error('인벤토리를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, []);

  const handleUseItem = async (invId: string, itemData: InventoryItemData) => {
    setUsing(invId);

    try {
      const result = await useInventoryItem(invId);

      // 아이템 효과 적용
      const effect = itemData.item.effect;

      if (effect?.hintCount) {
        setAvailableHints(prev => prev + effect.hintCount);
        toast.success(`💡 힌트 ${effect.hintCount}개를 획득했습니다!`);
      }

      if (effect?.freezeSeconds) {
        // Arena 모드에서는 서버에 소켓 이벤트 전송
        if (socket && arenaId && userId) {
          socket.emit('arena:use-item', {
            arenaId,
            userId,
            itemType: 'time_freeze',
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
        addBuff({ type: 'score_boost', value: effect.scoreBoost });
        toast.success(`🚀 점수 ${effect.scoreBoost}% 증가 효과 적용!`);
      }

      if (effect?.invincibleSeconds) {
        addBuff({ type: 'invincible', value: effect.invincibleSeconds, expiresAt: Date.now() + effect.invincibleSeconds * 1000 });
        toast.success(`🛡️ ${effect.invincibleSeconds}초 동안 무적 상태!`);

        // 무적 해제
        setTimeout(() => {
          // removeBuff('invincible')는 PlayContext에 추가 필요
        }, effect.invincibleSeconds * 1000);
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
            {items.map((invItem) => (
              <div key={invItem._id} className="inventory-item">
                {invItem.item.imageUrl && (
                  <img
                    src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5001'}${invItem.item.imageUrl}`}
                    alt={invItem.item.name}
                    style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }}
                  />
                )}
                <div className="item-info">
                  <h3>{invItem.item.icon} {invItem.item.name}</h3>
                  <p>{invItem.item.description}</p>
                  <span>보유: {invItem.quantity}개</span>

                  {isInGame && (
                    <button
                      className="use-btn"
                      onClick={() => handleUseItem(invItem._id, invItem)}
                      disabled={using === invItem._id}
                      style={{
                        marginTop: 8,
                        padding: '6px 12px',
                        background: '#00f5ff',
                        border: 'none',
                        borderRadius: 4,
                        color: '#000',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {using === invItem._id ? '사용 중...' : '사용하기'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryModal;