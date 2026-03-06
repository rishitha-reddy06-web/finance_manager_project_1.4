import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/alerts');
      setAlerts(res.data.data);
      setUnreadCount(res.data.unreadCount);
    } catch (err) {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await axios.put(`/api/alerts/${id}/read`);
      setAlerts(alerts.map(a => a._id === id ? {...a, isRead: true} : a));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {}
  };

  const markAllRead = async () => {
    try {
      await axios.put('/api/alerts/read-all');
      setAlerts(alerts.map(a => ({...a, isRead: true})));
      setUnreadCount(0);
      toast.success('All alerts marked as read');
    } catch (err) {}
  };

  const deleteAlert = async (id) => {
    try {
      await axios.delete(`/api/alerts/${id}`);
      setAlerts(alerts.filter(a => a._id !== id));
      toast.success('Alert deleted');
    } catch (err) {}
  };

  const severityColors = {
    danger: 'var(--danger)',
    warning: 'var(--warning)',
    info: 'var(--info)',
  };

  const severityIcons = {
    danger: '🚨',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts & Notifications</h1>
          <p className="page-subtitle">
            {unreadCount > 0 ? `${unreadCount} unread alerts` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
            ✓ Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div style={{display:'flex', flexDirection:'column', gap: 12}}>
          {[1,2,3].map(i => <div key={i} className="card skeleton" style={{height: 80}} />)}
        </div>
      ) : alerts.length > 0 ? (
        <div style={{display:'flex', flexDirection:'column', gap: 12}}>
          {alerts.map(alert => (
            <div key={alert._id} className="alert-item" style={{
              background: 'var(--bg-card)',
              border: `1px solid ${alert.isRead ? 'var(--border)' : severityColors[alert.severity]}`,
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              opacity: alert.isRead ? 0.7 : 1,
              transition: 'all 0.2s',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${severityColors[alert.severity]}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0,
              }}>
                {severityIcons[alert.severity]}
              </div>

              <div style={{flex: 1}}>
                <div className="flex items-center gap-2" style={{marginBottom: 4}}>
                  <strong style={{fontSize: 14, color: 'var(--text-primary)'}}>{alert.title}</strong>
                  {!alert.isRead && (
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: severityColors[alert.severity], flexShrink: 0,
                    }} />
                  )}
                </div>
                <p style={{fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4}}>
                  {alert.message}
                </p>
                <p style={{fontSize: 11, color: 'var(--text-secondary)'}}>
                  {new Date(alert.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="flex gap-2">
                {!alert.isRead && (
                  <button className="btn btn-secondary btn-sm" onClick={() => markRead(alert._id)}
                    title="Mark as read">✓</button>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => deleteAlert(alert._id)}
                  title="Delete">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{textAlign:'center', padding: 48}}>
          <div style={{fontSize: 48, marginBottom: 16}}>🔔</div>
          <h3 style={{marginBottom: 8}}>No alerts</h3>
          <p className="text-muted">You'll be notified when you approach or exceed your budgets</p>
        </div>
      )}
    </div>
  );
};

export default Alerts;
