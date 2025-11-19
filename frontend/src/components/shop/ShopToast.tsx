import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import "../../assets/scss/shop/ShopToast.scss";

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

  const toastElement = (
    <div className="shop-toast">
      {icon && <img src={icon} className="shop-toast-icon" alt="icon" />}
      <span className="shop-toast-msg">{message}</span>
    </div>
  );

  return ReactDOM.createPortal(toastElement, document.body);
};

export default ShopToast;