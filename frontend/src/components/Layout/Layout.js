import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

const navItems = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard' },
  { path: '/transactions', icon: '💳', label: 'Transactions' },
  { path: '/budgets', icon: '🎯', label: 'Budgets' },
  { path: '/predictions', icon: '🧠', label: 'AI Assistant' },
  { path: '/reports', icon: '📈', label: 'Reports' },
  { path: '/alerts', icon: '🔔', label: 'Alerts' },
  { path: '/profile', icon: '👤', label: 'Profile' },
];

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    // Refresh every minute
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await axios.get('/api/alerts');
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch unread count');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">💰</div>
          <span>Finance<span className="logo-ai">AI</span></span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon" style={{ position: 'relative' }}>
                {item.icon}
                {item.path === '/alerts' && unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -5, right: -5, width: 14, height: 14,
                    background: 'var(--danger)', borderRadius: '50%', border: '2px solid var(--bg-card)',
                    fontSize: 8, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <p className="user-name">{user?.name}</p>
            <p className="user-email">{user?.email}</p>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            🚪
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-container">
        {/* Top bar */}
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <div className="topbar-right">
            <div 
              className="topbar-alerts" 
              onClick={() => navigate('/alerts')}
              style={{ position: 'relative', cursor: 'pointer', marginRight: 15, fontSize: 20 }}
            >
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: 0, width: 10, height: 10,
                  background: 'var(--danger)', borderRadius: '50%', border: '2px solid var(--bg-card)'
                }} />
              )}
            </div>
            <span className="topbar-greeting">
              Welcome back, <strong>{user?.name?.split(' ')[0]}</strong>
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
