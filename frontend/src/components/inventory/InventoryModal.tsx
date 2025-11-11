import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getInventory } from '../../api/axiosShop';
import '../../assets/scss/inventory/InventoryModal.scss';

interface InventoryItem {
  _id: string;
  name: string;
  description: string;
  quantity: number;
}

interface InventoryModalProps {
  onClose: () => void;
}

const InventoryModal: React.FC<InventoryModalProps> = ({ onClose }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

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
            {items.map((item) => (
              <div key={item._id} className="inventory-item">
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <span>보유: {item.quantity}개</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryModal;