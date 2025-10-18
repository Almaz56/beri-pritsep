import React from 'react';
import { NavLink } from 'react-router-dom';
import '../styles/navbar.css';

const NavBar: React.FC = () => {
  return (
    <nav className="navbar">
      <NavLink to="/" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon">🏠</span>
        <span className="nav-label">Домой</span>
      </NavLink>
      <NavLink to="/bookings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon">📅</span>
        <span className="nav-label">Брони</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon">👤</span>
        <span className="nav-label">Профиль</span>
      </NavLink>
      <NavLink to="/support" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon">💬</span>
        <span className="nav-label">Поддержка</span>
      </NavLink>
    </nav>
  );
};

export default NavBar;


