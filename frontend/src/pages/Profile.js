import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({
    name: user?.name || '',
    currency: user?.currency || 'INR',
    monthlyIncome: user?.monthlyIncome || '',
    savingsGoal: user?.savingsGoal || '',
    alertPreferences: {
      email: user?.alertPreferences?.email ?? true,
      overspendingThreshold: user?.alertPreferences?.overspendingThreshold ?? 80,
    },
  });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [recentActivity, setRecentActivity] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchActivity();
    fetchCategories();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/auth/profile-stats');
      setStats(res.data.data);
    } catch (err) {
      console.error('Failed to fetch profile stats');
    }
  };

  const fetchActivity = async () => {
    try {
      const res = await axios.get('/api/transactions?limit=8');
      setRecentActivity(res.data.data);
    } catch (err) {
      console.error('Failed to fetch activity');
    }
  };

  const fetchCategories = async () => {
    try {
      const now = new Date();
      const res = await axios.get(`/api/transactions/summary/monthly?month=${now.getMonth() + 1}&year=${now.getFullYear()}`);
      setCategories(res.data.data.categoryBreakdown || []);
    } catch (err) {
      console.error('Failed to fetch category breakdown');
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(form);
      toast.success('Profile updated successfully');
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    setPwLoading(true);
    try {
      await axios.put('/api/auth/updatepassword', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success('Password updated');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setPwLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('CRITICAL: This will delete ALL history. Continue?')) return;
    try {
      await axios.delete('/api/transactions/clear/all');
      toast.success('History cleared');
      fetchStats();
      fetchActivity();
      setCategories([]);
    } catch (err) {
      toast.error('Failed to clear data');
    }
  };

  const getUserTier = (count) => {
    if (count > 50) return { name: 'Budget Master', color: '#8b5cf6' };
    if (count > 20) return { name: 'Smart Saver', color: '#10b981' };
    if (count > 5) return { name: 'Explorer', color: '#6366f1' };
    return { name: 'Newbie', color: '#94a3b8' };
  };

  const getFinancialTip = () => {
    if (!stats) return "Add your first transaction to get personalized AI tips!";
    if (stats.savings < 0) return "Alert: Your expenses exceed your income this month. Consider reducing non-essential spending.";
    if (savingsProgress >= 100) return "Excellent! You've reached your savings goal. Time to invest the surplus!";
    if (stats.totalSpent > stats.totalBudget) return "Warning: You have exceeded your set budget. Review your transactions.";
    return "Tip: Automating your savings to your goal early in the month helps hit targets faster.";
  };

  const savingsProgress = stats ? Math.min(100, (stats.savings / (form.savingsGoal || 1)) * 100) : 0;
  const tier = getUserTier(stats?.transactionCount || 0);

  return (
    <div className="fade-in profile-dashboard">
      <div className="page-header" style={{ marginBottom: 30 }}>
        <div>
          <h1 className="page-title">Financial Identity</h1>
          <p className="page-subtitle">Personal command center & wealth performance</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨️ Export</button>
          <button className="btn btn-danger btn-sm" onClick={handleClearData}>🗑️ Reset</button>
        </div>
      </div>

      <div className="card profile-header-card" style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: 30,
        marginBottom: 30,
        borderRadius: 20,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: -50, right: -50, width: 250, height: 250,
          background: `radial-gradient(circle, ${tier.color}33 0%, transparent 70%)`, filter: 'blur(40px)'
        }} />
        
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="profile-avatar-large" style={{
            width: 100, height: 100, borderRadius: '50%', background: tier.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 800,
            boxShadow: `0 0 25px ${tier.color}66`, border: '4px solid #1e293b'
          }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 5 }}>{user?.name}</h2>
            <p className="text-muted" style={{ marginBottom: 15 }}>{user?.email}</p>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              <span className="badge" style={{ background: tier.color, color: 'white' }}>{tier.name} Tier</span>
              <span className="badge badge-secondary">{stats?.transactionCount || 0} Transactions</span>
              <span className="badge badge-success">Verified</span>
            </div>
          </div>

          <div className="stats-mini-grid flex gap-8">
            <div className="text-center">
              <div className="text-muted text-xs uppercase" style={{ letterSpacing: 1 }}>Monthly Savings</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)' }}>
                {stats?.totalIncome > 0 ? ((stats.savings / stats.totalIncome) * 100).toFixed(0) : 0}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted text-xs uppercase" style={{ letterSpacing: 1 }}>Goal Reach</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--secondary)' }}>
                {savingsProgress.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ 
        marginBottom: 30, 
        borderLeft: `4px solid ${tier.color}`, 
        background: 'rgba(99, 102, 241, 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: 15,
        padding: '15px 20px'
      }}>
        <div style={{ fontSize: 24 }}>💡</div>
        <div>
          <p className="font-bold text-sm" style={{ color: 'var(--primary)' }}>AI Financial Insight</p>
          <p className="text-sm">{getFinancialTip()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 className="card-title">🕒 Recent Activity</h3>
            <div className="activity-timeline mt-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recentActivity.length > 0 ? recentActivity.map((act, i) => (
                <div key={i} className="activity-item flex items-center justify-between p-2 rounded-lg hover:bg-slate-800 transition-all">
                  <div className="flex gap-3 items-center">
                    <div style={{ fontSize: 18 }}>{getCategoryIcon(act.category)}</div>
                    <div>
                      <div className="text-sm font-semibold">{act.category}</div>
                      <div className="text-[10px] text-muted">{new Date(act.date).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className={`text-sm font-bold ${act.type === 'income' ? 'text-success' : 'text-danger'}`}>
                    {act.type === 'income' ? '+' : '-'}₹{act.amount.toLocaleString()}
                  </div>
                </div>
              )) : (
                <div className="text-center py-6 text-xs text-muted">No transactions found</div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">🏷️ Spending by Category</h3>
            <div className="space-y-3 mt-4">
              {categories.length > 0 ? categories.slice(0, 5).map((cat, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{cat._id}</span>
                    <span className="font-bold">₹{cat.total.toLocaleString()}</span>
                  </div>
                  <div className="progress-bar" style={{ height: 4 }}>
                    <div className="progress-fill" style={{ 
                      width: `${(cat.total / (stats?.totalSpent || 1)) * 100}%`,
                      background: COLORS[i % COLORS.length]
                    }} />
                  </div>
                </div>
              )) : (
                <div className="text-center py-4 text-xs text-muted">No category data</div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 className="card-title">💼 Financial Profile</h3>
            <form onSubmit={handleProfileUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label>Display Name</label>
                <input type="text" className="form-input" value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <select className="form-select" value={form.currency}
                  onChange={e => setForm({...form, currency: e.target.value})}>
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Monthly Income</label>
                <input type="number" className="form-input" value={form.monthlyIncome}
                  onChange={e => setForm({...form, monthlyIncome: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Savings Target</label>
                <input type="number" className="form-input" value={form.savingsGoal}
                  onChange={e => setForm({...form, savingsGoal: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: 'auto' }}>
                  Update Information
                </button>
              </div>
            </form>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <h3 className="card-title">🎯 Wealth Analytics</h3>
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="text-muted text-xs uppercase mb-1">Current Month Savings</div>
                <div className="text-2xl font-extrabold text-success">₹{stats?.savings.toLocaleString() || 0}</div>
              </div>
              <div className="text-right">
                <div className="text-muted text-xs uppercase mb-1">Goal Status</div>
                <div className="font-bold">{savingsProgress.toFixed(1)}% Completed</div>
              </div>
            </div>
            <div className="progress-bar" style={{ height: 12, borderRadius: 6 }}>
              <div className="progress-fill" style={{ width: `${savingsProgress}%`, background: tier.color }} />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                <p className="text-xs text-muted mb-1">Income Recorded</p>
                <p className="text-xl font-bold text-success">₹{stats?.totalIncome.toLocaleString() || 0}</p>
              </div>
              <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                <p className="text-xs text-muted mb-1">Expense Recorded</p>
                <p className="text-xl font-bold text-danger">₹{stats?.totalSpent.toLocaleString() || 0}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">🔐 Security</h3>
            <form onSubmit={handlePasswordChange} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="password" placeholder="Current Password" className="form-input" 
                value={pwForm.currentPassword} onChange={e => setPwForm({...pwForm, currentPassword: e.target.value})} />
              <input type="password" placeholder="New Password" className="form-input" 
                value={pwForm.newPassword} onChange={e => setPwForm({...pwForm, newPassword: e.target.value})} />
              <button type="submit" className="btn btn-secondary md:col-span-2" disabled={pwLoading}>
                {pwLoading ? 'Changing...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const getCategoryIcon = (category) => {
  const icons = {
    'Food & Dining': '🍔', 'Transport': '🚗', 'Shopping': '🛍️', 'Entertainment': '🎬',
    'Healthcare': '💊', 'Utilities': '⚡', 'Housing': '🏠', 'Education': '📚',
    'Travel': '✈️', 'Investment': '📈', 'Salary': '💼', 'Freelance': '💻',
    'Business': '🏢', 'Insurance': '🛡️', 'EMI & Loans': '💳', 'Subscriptions': '📅',
    'Gifts & Donations': '🎁', 'Personal Care': '✨', 'Other': '💰'
  };
  return icons[category] || '💳';
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

export default Profile;
