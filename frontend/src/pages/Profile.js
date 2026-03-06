import React, { useState } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user, updateProfile } = useAuth();
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
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(form);
      toast.success('Profile updated successfully');
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

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile Settings</h1>
          <p className="page-subtitle">Manage your account and preferences</p>
        </div>
      </div>

      <div className="profile-grid">
        {/* Profile section */}
        <div>
          <div className="card" style={{marginBottom: 24}}>
            <div className="profile-avatar-section">
              <div className="profile-avatar">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{fontSize: 20, fontWeight: 700}}>{user?.name}</h3>
                <p className="text-muted">{user?.email}</p>
                <p className="text-muted" style={{fontSize: 12}}>
                  Member since {new Date(user?.createdAt || Date.now()).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Personal Information</h3>
            <form onSubmit={handleProfileUpdate}>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" className="form-input" value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <select className="form-select" value={form.currency}
                  onChange={e => setForm({...form, currency: e.target.value})}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CAD">CAD (C$)</option>
                  <option value="AUD">AUD (A$)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Monthly Income</label>
                <input type="number" className="form-input" placeholder="0" min="0"
                  value={form.monthlyIncome}
                  onChange={e => setForm({...form, monthlyIncome: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Savings Goal</label>
                <input type="number" className="form-input" placeholder="0" min="0"
                  value={form.savingsGoal}
                  onChange={e => setForm({...form, savingsGoal: e.target.value})} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>

        <div>
          {/* Alert preferences */}
          <div className="card" style={{marginBottom: 24}}>
            <h3 className="card-title">Alert Preferences</h3>
            <div className="form-group">
              <label style={{display:'flex', alignItems:'center', gap:12, cursor:'pointer'}}>
                <input type="checkbox"
                  checked={form.alertPreferences.email}
                  onChange={e => setForm({...form, alertPreferences: {...form.alertPreferences, email: e.target.checked}})}
                  style={{width:16, height:16}} />
                Email notifications
              </label>
            </div>
            <div className="form-group">
              <label>Budget Warning Threshold: {form.alertPreferences.overspendingThreshold}%</label>
              <input type="range" min="50" max="100" step="5"
                value={form.alertPreferences.overspendingThreshold}
                onChange={e => setForm({...form, alertPreferences: {
                  ...form.alertPreferences, overspendingThreshold: parseInt(e.target.value)
                }})}
                style={{width:'100%', accentColor: 'var(--primary)', marginTop: 8}} />
              <div className="flex justify-between" style={{fontSize: 11, color: 'var(--text-secondary)'}}>
                <span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleProfileUpdate} disabled={loading}>
              Save Preferences
            </button>
          </div>

          {/* Change password */}
          <div className="card">
            <h3 className="card-title">Change Password</h3>
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label>Current Password</label>
                <input type="password" className="form-input" placeholder="••••••••"
                  value={pwForm.currentPassword}
                  onChange={e => setPwForm({...pwForm, currentPassword: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" className="form-input" placeholder="Min 6 characters"
                  value={pwForm.newPassword}
                  onChange={e => setPwForm({...pwForm, newPassword: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input type="password" className="form-input" placeholder="Repeat new password"
                  value={pwForm.confirmPassword}
                  onChange={e => setPwForm({...pwForm, confirmPassword: e.target.value})} required />
              </div>
              <button type="submit" className="btn btn-secondary" disabled={pwLoading}>
                {pwLoading ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
