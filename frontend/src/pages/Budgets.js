import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const BUDGET_CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment', 'Healthcare',
  'Utilities', 'Housing', 'Education', 'Travel', 'Investment', 'Other', 'Total',
];

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const BudgetModal = ({ budget, month, year, onClose, onSave }) => {
  const [form, setForm] = useState(budget ? {
    category: budget.category,
    limit: budget.limit,
    month: budget.month,
    year: budget.year,
    color: budget.color || '#6366f1',
  } : {
    category: 'Food & Dining', limit: '', month, year, color: '#6366f1',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...form, limit: parseFloat(form.limit) };
    try {
      if (budget?._id) {
        await axios.put(`/api/budgets/${budget._id}`, payload);
        toast.success('Budget updated');
      } else {
        await axios.post('/api/budgets', payload);
        toast.success('Budget created');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving budget');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{budget?._id ? 'Edit Budget' : 'Create Budget'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Month</label>
            <div className="flex gap-2">
              <select className="form-select" value={form.month}
                onChange={e => setForm(prev => ({...prev, month: parseInt(e.target.value)}))}>
                {MONTH_NAMES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select className="form-select" style={{width: 90}} value={form.year}
                onChange={e => setForm(prev => ({...prev, year: parseInt(e.target.value)}))}>
                {[2023, 2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Category</label>
            <select className="form-select" value={form.category}
              onChange={e => setForm(prev => ({...prev, category: e.target.value}))}>
              {BUDGET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Budget Limit (₹)</label>
            <input type="number" className="form-input" placeholder="Enter amount" min="1"
              value={form.limit} onChange={e => setForm(prev => ({...prev, limit: e.target.value}))} required />
          </div>
          <div className="form-group">
            <label>Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <div key={c} onClick={() => setForm(prev => ({...prev, color: c}))}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c,
                    cursor: 'pointer', border: form.color === c ? '3px solid white' : '2px solid transparent',
                    boxShadow: form.color === c ? '0 0 0 2px var(--primary)' : 'none',
                  }} />
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{width:'auto'}}>
              {loading ? 'Saving...' : 'Save Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Budgets = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBudgets();
  }, [month, year]);

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/budgets?month=${month}&year=${year}`);
      setBudgets(res.data.data);
    } catch (err) {
      toast.error('Failed to load budgets');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this budget?')) return;
    try {
      await axios.delete(`/api/budgets/${id}`);
      toast.success('Budget deleted');
      fetchBudgets();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="fade-in">
      {modal !== null && (
        <BudgetModal
          budget={modal === 'new' ? null : modal}
          month={month} year={year}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchBudgets(); }}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Budgets</h1>
          <p className="page-subtitle">Track your spending limits</p>
        </div>
        <div className="flex gap-3 items-center">
          <select className="form-select" style={{width: 120}} value={month}
            onChange={e => setMonth(parseInt(e.target.value))}>
            {monthNames.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select className="form-select" style={{width: 90}} value={year}
            onChange={e => setYear(parseInt(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>
            + New Budget
          </button>
        </div>
      </div>

      {loading ? (
        <div className="budgets-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="card">
              <div className="skeleton" style={{height: 20, width: '60%', marginBottom: 12}} />
              <div className="skeleton" style={{height: 12, width: '80%', marginBottom: 16}} />
              <div className="skeleton" style={{height: 8, borderRadius: 4}} />
            </div>
          ))}
        </div>
      ) : budgets.length > 0 ? (
        <div className="budgets-grid">
          {budgets.map(b => {
            const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
            const overBudget = b.spent > b.limit;
            const nearLimit = !overBudget && pct >= 80;
            return (
              <div key={b._id} className="card budget-card">
                <div className="budget-card-header">
                  <div className="budget-color-dot" style={{background: b.color}} />
                  <h3 className="budget-category">{b.category}</h3>
                  <div className="flex gap-2">
                    <button className="btn btn-secondary btn-sm" onClick={() => setModal(b)}>✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(b._id)}>🗑️</button>
                  </div>
                </div>

                <div className="budget-amounts">
                  <div>
                    <p className="budget-label">Spent</p>
                    <p className={`budget-value ${overBudget ? 'text-danger' : ''}`}>
                      ₹{b.spent.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                  </div>
                  <div>
                    <p className="budget-label">Limit</p>
                    <p className="budget-value">₹{Number(b.limit).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                  </div>
                  <div>
                    <p className="budget-label">Remaining</p>
                    <p className={`budget-value ${overBudget ? 'text-danger' : 'text-success'}`}>
                      ₹{Math.max(0, b.limit - b.spent).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                  </div>
                </div>

                <div className="progress-bar" style={{marginTop: 16}}>
                  <div className="progress-fill" style={{
                    width: `${pct}%`,
                    background: overBudget ? 'var(--danger)' : nearLimit ? 'var(--warning)' : b.color,
                  }} />
                </div>

                <div className="flex justify-between" style={{marginTop: 8}}>
                  <span style={{fontSize: 12, color: 'var(--text-secondary)'}}>
                    {overBudget ? '⚠️ Over budget!' : nearLimit ? '⚠️ Near limit' : '✅ On track'}
                  </span>
                  <span style={{fontSize: 12, fontWeight: 600, color: overBudget ? 'var(--danger)' : 'var(--text-secondary)'}}>
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{textAlign: 'center', padding: 48}}>
          <div style={{fontSize: 48, marginBottom: 16}}>🎯</div>
          <h3 style={{marginBottom: 8}}>No budgets for this month</h3>
          <p className="text-muted" style={{marginBottom: 24}}>Create budgets to track your spending limits</p>
          <button className="btn btn-primary" style={{display: 'inline-flex'}} onClick={() => setModal('new')}>
            + Create Your First Budget
          </button>
        </div>
      )}
    </div>
  );
};

export default Budgets;
