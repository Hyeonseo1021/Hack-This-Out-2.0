import React from 'react';
import { NavLink } from 'react-router-dom';
import '../../assets/scss/admin/AdminSidebar.scss';
import { FaTachometerAlt, FaUsers, FaHome, FaCogs, FaClipboardList, FaServer, FaShopify, FaGamepad,FaBook } from 'react-icons/fa';

const Sidebar: React.FC = () => {
  return (
    <div className="admin-sidebar">
      <h2 className="sidebar-title">Admin Dashboard</h2>
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
          <FaHome className="sidebar-icon" />
          Main Page
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
          <FaTachometerAlt className="sidebar-icon" />
          Dashboard Home
        </NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'active' : '')}>
          <FaUsers className="sidebar-icon" />
          Users
        </NavLink>
        <NavLink to="/admin/machines" className={({ isActive }) => (isActive ? 'active' : '')}>
          <FaServer className="sidebar-icon" />
          Machines
        </NavLink>
        <NavLink to="/admin/contests" className={({ isActive }) => (isActive ? 'active' : '')}>
          <FaClipboardList className="sidebar-icon" />
          Contests
        </NavLink>
        <NavLink to="/admin/instances" className={({ isActive }) => (isActive ? 'active' : '')}>
          <FaCogs className="sidebar-icon" />
          Instances
        </NavLink>
        <NavLink to="/admin/arenas" className={({ isActive }) => (isActive ? 'active' : '')}>
          <FaGamepad className="sidebar-icon" />
          Arenas
        </NavLink>
        <NavLink to="/admin/scenarios" className={({ isActive }) => (isActive ? 'active' : '')}>
          <FaBook className="sidebar-icon" />
          Arena Scenarios
        </NavLink>
        <NavLink to="/admin/item" className={({ isActive }) => (isActive ? 'active' : '')}>
          <FaShopify className="sidebar-icon" />
          Items
        </NavLink>
      </nav>
    </div>
  );
};

export default Sidebar;