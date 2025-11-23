// Sidebar.tsx

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MdOutlineLeaderboard, MdLeaderboard } from "react-icons/md";
import { FaBook } from "react-icons/fa";
import { PiComputerTowerBold, PiComputerTowerFill } from "react-icons/pi";
import { RiArrowLeftDoubleFill, RiArrowRightDoubleFill } from "react-icons/ri";
import { GiCrossedSwords } from "react-icons/gi";
import { FaShop } from 'react-icons/fa6';
import styles from '../../assets/scss/section/_sidebar.module.scss';
import logo from "../../assets/img/icon/HTO nud.png";
import collapsed_logo from '../../assets/img/icon/Hack cat.png';

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: (forceCollapse?: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleSidebar }) => {
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [isAutoCollapsed, setIsAutoCollapsed] = useState(false);

  // ==================
  // 경로 Active 조건
  // ==================

  // Manual 활성화: /manual + /machinep 포함
  const isManualActive =
    location.pathname.startsWith('/manual') ||
    location.pathname.startsWith('/machinep');

  // Machines 활성화: /machine 정확하게만
  const isMachineActive =
    location.pathname === '/machine' ||
    location.pathname.startsWith('/machine/');

  // Leaderboard
  const isLeaderboardActive = location.pathname.startsWith('/leaderboard');

  const isBattleActive = location.pathname.startsWith('/battle');

  const isShopActive = location.pathname.startsWith('/shop');

  // ==================
  // Resize auto-collapse
  // ==================
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1000 && !isCollapsed) {
        toggleSidebar(true);
        setIsAutoCollapsed(true);
      } else if (window.innerWidth > 1000 && isAutoCollapsed) {
        toggleSidebar(false);
        setIsAutoCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed, isAutoCollapsed, toggleSidebar]);

  return (
    <div className={`${styles.sidebarMenu} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.headerParent}>
        <div className={styles.header}>

          {/* 로고 */}
          <Link to='/' className={styles.logoimage}>
            <img className={styles.logoContainerIcon} alt="" src={logo} />
          </Link>

          <div className={styles.sidebarMenuButton}>
            <button
              className={styles.collapse_button}
              onClick={() => {
                toggleSidebar();
                setIsAutoCollapsed(false);
                setIsHovered(false);
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {isCollapsed && isHovered && <RiArrowRightDoubleFill className={styles.collapse_icon_open} size={40} />}
              {isCollapsed && !isHovered && (
                <img className={styles.icon_logo} src={collapsed_logo} alt="Collapsed Logo" />
              )}
              {!isCollapsed && <RiArrowLeftDoubleFill className={styles.collapse_icon_close} size={40} />}
            </button>
          </div>

        </div>

        <div className={styles.headerParent}>
          <div className={styles.topMenu}>
            <li className={styles.verticalMenuList}>

              {/* Manual */}
              <Link
                to="/manual"
                className={`${styles.verticalMenuItem} ${isManualActive ? styles.selected : ''}`}
                data-tooltip="Manual"
              >
                <FaBook className={styles.menuIcon} />
                <div className={styles.label}>Manual</div>
              </Link>

              {/* Leaderboard */}
              <Link
                to="/leaderboard"
                className={`${styles.verticalMenuItem} ${isLeaderboardActive ? styles.selected : ''}`}
                data-tooltip="LeaderBoard"
              >
                {isLeaderboardActive ?
                  <MdLeaderboard className={styles.menuIcon} /> :
                  <MdOutlineLeaderboard className={styles.menuIcon} />
                }
                <div className={styles.label}>LeaderBoard</div>
              </Link>

              {/* Battle */}
              <Link
                to="/battle"
                className={`${styles.verticalMenuItem} ${isBattleActive ? styles.selected : ''}`}
                data-tooltip="Battle"
              >
                <GiCrossedSwords className={styles.menuIcon} />
                <div className={styles.label}>Battle</div>
              </Link>

              {/* Machines */}
              <Link
                to="/machine"
                className={`${styles.verticalMenuItem} ${isMachineActive ? styles.selected : ''}`}
                data-tooltip="Machines"
              >
                {isMachineActive ?
                  <PiComputerTowerFill className={styles.menuIcon} /> :
                  <PiComputerTowerBold className={styles.menuIcon} />
                }
                <div className={styles.label}>Machines</div>
              </Link>

              {/* Shop */}
              <Link
                to="/shop"
                className={`${styles.verticalMenuItem} ${isShopActive ? styles.selected : ''}`}
                data-tooltip="Shop"
              >
                <FaShop className={styles.menuIcon} />
                <div className={styles.label}>Shop</div>
              </Link>

            </li>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
