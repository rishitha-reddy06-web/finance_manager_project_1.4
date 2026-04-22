import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import CustomDatePicker from '../components/CustomDatePicker';

const BUDGET_CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment', 'Healthcare',
  'Utilities', 'Housing', 'Education', 'Travel', 'Investment', 
  'Insurance', 'EMI & Loans', 'Subscriptions', 'Gifts & Donations', 
  'Personal Care', 'Other', 'Total',
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
  const [isBulk, setIsBulk] = useState(false);
  const [bulkMode, setBulkMode] = useState('specific'); // 'specific' or 'range'
  const [selectedMonths, setSelectedMonths] = useState([month]);
  const [range, setRange] = useState({ 
    fromMonth: month, fromYear: year, 
    toMonth: month === 12 ? 1 : month + 1, 
    toYear: month === 12 ? year + 1 : year 
  });
  const [loading, setLoading] = useState(false);

  const toggleMonth = (m) => {
    setSelectedMonths(prev => 
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isBulk && !budget?._id) {
        let payload = { ...form, limit: parseFloat(form.limit) };
        if (bulkMode === 'specific') {
          payload.periods = selectedMonths.map(m => ({ month: m, year: form.year }));
        } else {
          payload.range = range;
        }
        
        const res = await axios.post('/api/budgets/bulk', payload);
        if (res.data.errors) {
          toast.warning(`Created ${res.data.count} budgets. Some already existed.`);
        } else {
          toast.success(`Created budgets for ${res.data.count} months`);
        }
      } else if (budget?._id) {
        await axios.put(`/api/budgets/${budget._id}`, { ...form, limit: parseFloat(form.limit) });
        toast.success('Budget updated');
      } else {
        await axios.post('/api/budgets', { ...form, limit: parseFloat(form.limit) });
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
      <div className="modal" style={{ maxWidth: 450 }}>
        <div className="modal-header">
          <h3 className="modal-title">{budget?._id ? 'Edit Budget' : 'Create Budget'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {!budget?._id && (
            <div className="form-group">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isBulk} onChange={e => setIsBulk(e.target.checked)} />
                <span style={{fontSize: 14, fontWeight: 600, color: 'var(--primary)'}}>Set for multiple months</span>
              </label>
              {isBulk && (
                <div className="flex gap-4 mt-2 p-1 bg-slate-800 rounded-lg" style={{fontSize: 12}}>
                  <button type="button" className={`flex-1 p-1 rounded ${bulkMode === 'specific' ? 'bg-primary text-white' : ''}`}
                    onClick={() => setBulkMode('specific')}>Specific Months</button>
                  <button type="button" className={`flex-1 p-1 rounded ${bulkMode === 'range' ? 'bg-primary text-white' : ''}`}
                    onClick={() => setBulkMode('range')}>Date Range</button>
                </div>
              )}
            </div>
          )}

          {!isBulk ? (
            <div className="form-group">
              <label>Month & Year</label>
              <div className="flex gap-2">
                <select className="form-select" value={form.month}
                  onChange={e => setForm(prev => ({...prev, month: parseInt(e.target.value)}))}>
                  {MONTH_NAMES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
                <select className="form-select" style={{width: 100}} value={form.year}
                  onChange={e => setForm(prev => ({...prev, year: parseInt(e.target.value)}))}>
                  {[2023, 2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
          ) : bulkMode === 'specific' ? (
            <>
              <div className="form-group">
                <label>Select Year</label>
                <select className="form-select" value={form.year}
                  onChange={e => setForm(prev => ({...prev, year: parseInt(e.target.value)}))}>
                  {[2023, 2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Select Months</label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {MONTH_NAMES.map((m, i) => (
                    <div key={i} onClick={() => toggleMonth(i+1)}
                      className={`month-pill ${selectedMonths.includes(i+1) ? 'active' : ''}`}
                      style={{
                        padding: '6px', borderRadius: 6, fontSize: 11, textAlign: 'center', cursor: 'pointer',
                        border: '1px solid var(--border)',
                        background: selectedMonths.includes(i+1) ? 'var(--primary)' : 'var(--bg)',
                        color: selectedMonths.includes(i+1) ? 'white' : 'var(--text-secondary)',
                      }}>
                      {m.substring(0, 3)}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="form-group">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{fontSize: 11}}>FROM</label>
                  <div className="flex flex-col gap-2">
                    <select className="form-select" value={range.fromMonth}
                      onChange={e => setRange(prev => ({...prev, fromMonth: parseInt(e.target.value)}))}>
                      {MONTH_NAMES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <select className="form-select" value={range.fromYear}
                      onChange={e => setRange(prev => ({...prev, fromYear: parseInt(e.target.value)}))}>
                      {[2023, 2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{fontSize: 11}}>TO</label>
                  <div className="flex flex-col gap-2">
                    <select className="form-select" value={range.toMonth}
                      onChange={e => setRange(prev => ({...prev, toMonth: parseInt(e.target.value)}))}>
                      {MONTH_NAMES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <select className="form-select" value={range.toYear}
                      onChange={e => setRange(prev => ({...prev, toYear: parseInt(e.target.value)}))}>
                      {[2023, 2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

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

const QuickPlannerModal = ({ month, year, existingBudgets, onClose, onSave }) => {
  const [plannerData, setPlannerData] = useState(
    BUDGET_CATEGORIES.filter(c => c !== 'Total').map(cat => {
      const existing = existingBudgets.find(b => b.category === cat);
      return { category: cat, limit: existing ? existing.limit : '', color: existing ? existing.color : COLORS[Math.floor(Math.random() * COLORS.length)] };
    })
  );
  const [useRange, setUseRange] = useState(false);
  const [range, setRange] = useState({ 
    fromMonth: month, fromYear: year, 
    toMonth: month === 12 ? 1 : month + 1, 
    toYear: month === 12 ? year + 1 : year 
  });
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFromDateChange = (date) => {
    setRange(prev => ({ ...prev, fromMonth: date.getMonth() + 1, fromYear: date.getFullYear() }));
    setShowFromPicker(false);
  };

  const handleToDateChange = (date) => {
    setRange(prev => ({ ...prev, toMonth: date.getMonth() + 1, toYear: date.getFullYear() }));
    setShowToPicker(false);
  };

  const handleChange = (index, value) => {
    const newData = [...plannerData];
    newData[index].limit = value;
    setPlannerData(newData);
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      const budgetsToSave = plannerData.filter(d => d.limit !== '');
      const payload = { month, year, budgets: budgetsToSave };
      if (useRange) payload.range = range;

      await axios.post('/api/budgets/batch', payload);
      toast.success(useRange ? `Applied budgets across selected range!` : 'Monthly budgets updated');
      onSave();
    } catch (err) {
      toast.error('Failed to save batch budgets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ 
        maxWidth: 600, 
        width: '90%', 
        maxHeight: '85vh', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative',
        top: 0,
        margin: 'auto'
      }}>
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <h3 className="modal-title">⚡ Quick Budget Planner</h3>
            <p style={{fontSize: 11, color: 'var(--text-secondary)'}}>
              {useRange ? 'Applying plan to multiple months' : `Setting budgets for ${MONTH_NAMES[month-1]} ${year}`}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div style={{ flexShrink: 0, padding: '15px 20px', background: 'rgba(30, 41, 59, 0.8)', borderBottom: '1px solid var(--border)' }}>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" checked={useRange} onChange={e => setUseRange(e.target.checked)} />
            <span style={{fontSize: 13, fontWeight: 600, color: 'var(--primary)'}}>Apply this plan to a Date Range</span>
          </label>
          
          {useRange && (
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="flex flex-col gap-1 relative">
                <span style={{fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 1}}>FROM</span>
                <button 
                  type="button"
                  className="form-input text-left flex items-center justify-between"
                  onClick={() => { setShowFromPicker(!showFromPicker); setShowToPicker(false); }}
                  style={{ height: 36, fontSize: 13, background: 'var(--bg)', cursor: 'pointer' }}
                >
                  {MONTH_NAMES[range.fromMonth-1]} {range.fromYear}
                  <span>📅</span>
                </button>
                {showFromPicker && (
                  <div style={{ position: 'absolute', top: 40, left: 0, zIndex: 100 }}>
                    <CustomDatePicker 
                      selectedDate={new Date(range.fromYear, range.fromMonth - 1, 1)}
                      onChange={handleFromDateChange}
                      onClose={() => setShowFromPicker(false)}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1 relative">
                <span style={{fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 1}}>TO</span>
                <button 
                  type="button"
                  className="form-input text-left flex items-center justify-between"
                  onClick={() => { setShowToPicker(!showToPicker); setShowFromPicker(false); }}
                  style={{ height: 36, fontSize: 13, background: 'var(--bg)', cursor: 'pointer' }}
                >
                  {MONTH_NAMES[range.toMonth-1]} {range.toYear}
                  <span>📅</span>
                </button>
                {showToPicker && (
                  <div style={{ position: 'absolute', top: 40, right: 0, zIndex: 100 }}>
                    <CustomDatePicker 
                      selectedDate={new Date(range.toYear, range.toMonth - 1, 1)}
                      onChange={handleToDateChange}
                      onClose={() => setShowToPicker(false)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
              <tr style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 0' }}>CATEGORY</th>
                <th style={{ padding: '12px 0' }}>BUDGET LIMIT (₹)</th>
              </tr>
            </thead>
            <tbody>
              {plannerData.map((item, i) => (
                <tr key={item.category} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '10px 0', fontSize: 13 }}>
                    <div className="flex items-center gap-2">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                      {item.category}
                    </div>
                  </td>
                  <td style={{ padding: '10px 0' }}>
                    <input 
                      type="number" 
                      className="form-input" 
                      style={{ padding: '4px 10px', height: 32, fontSize: 13 }}
                      placeholder="0.00"
                      value={item.limit}
                      onChange={(e) => handleChange(i, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-footer" style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)', flexShrink: 0, marginTop: 0 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSaveAll} disabled={loading} style={{ width: 'auto' }}>
            {loading ? 'Saving...' : 'Save All Budgets'}
          </button>
        </div>
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
  const [plannerOpen, setPlannerOpen] = useState(false);
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

      {plannerOpen && (
        <QuickPlannerModal 
          month={month} year={year} 
          existingBudgets={budgets}
          onClose={() => setPlannerOpen(false)}
          onSave={() => { setPlannerOpen(false); fetchBudgets(); }}
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
          <button className="btn btn-secondary btn-sm" onClick={() => setPlannerOpen(true)}>
            ⚡ Quick Planner
          </button>
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
