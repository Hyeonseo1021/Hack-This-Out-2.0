import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import "../../assets/scss/shop/ShopToast.scss";

// API URL에서 base URL 추출
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

interface ShopToastProps {
  message: string;
  icon?: string;
  onClose: () => void;
}

const ShopToast: React.FC<ShopToastProps> = ({ message, icon, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, []);

  // icon이 상대 경로면 base URL 추가
  const iconUrl = icon ? (icon.startsWith('http') ? icon : `${API_BASE_URL}${icon}`) : undefined;

  const toastElement = (
    <div className="shop-toast">
      {iconUrl && <img src={iconUrl} className="shop-toast-icon" alt="icon" />}
      <span className="shop-toast-msg">{message}</span>
    </div>
  );

  return ReactDOM.createPortal(toastElement, document.body);
};

export default ShopToast;