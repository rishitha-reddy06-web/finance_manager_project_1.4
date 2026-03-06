import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

const Dashboard = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [cashflow, setCashflow] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const [summaryRes, cashflowRes, txRes, budgetRes] = await Promise.all([
        axios.get(`/api/transactions/summary/monthly?month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
        axios.get('/api/transactions/summary/cashflow?months=6'),
        axios.get('/api/transactions?limit=5'),
        axios.get(`/api/budgets?month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
      ]);
      setSummary(summaryRes.data.data);
      setCashflow(cashflowRes.data.data);
      setRecentTx(txRes.data.data);
      setBudgets(budgetRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = summary?.summary?.find(s => s._id === 'income')?.total || 0;
  const totalExpenses = summary?.summary?.find(s => s._id === 'expense')?.total || 0;
  const netSavings = totalIncome - totalExpenses;
  const pieData = summary?.categoryBreakdown?.map(c => ({
    name: c._id,
    value: Math.round(c.total * 100) / 100,
  })) || [];

  if (loading) {
    return (
      <div>
        <div className="stats-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{width: 52, height: 52, borderRadius: 14}} />
              <div style={{flex:1}}>
                <div className="skeleton" style={{width: '60%', height: 14, marginBottom: 8}} />
                <div className="skeleton" style={{width: '80%', height: 26}} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} Overview
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{background: 'rgba(16,185,129,0.15)'}}>💰</div>
          <div className="stat-content">
            <h3>Total Income</h3>
            <div className="stat-value text-success">₹{totalIncome.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background: 'rgba(239,68,68,0.15)'}}>💸</div>
          <div className="stat-content">
            <h3>Total Expenses</h3>
            <div className="stat-value text-danger">₹{totalExpenses.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background: 'rgba(99,102,241,0.15)'}}>📈</div>
          <div className="stat-content">
            <h3>Net Savings</h3>
            <div className={`stat-value ${netSavings >= 0 ? 'text-success' : 'text-danger'}`}>
              ₹{netSavings.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background: 'rgba(245,158,11,0.15)'}}>🎯</div>
          <div className="stat-content">
            <h3>Active Budgets</h3>
            <div className="stat-value">{budgets.length}</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Cash Flow */}
        <div className="card">
          <h3 className="card-title">Cash Flow (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={cashflow} margin={{top: 5, right: 5, left: 5, bottom: 5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{fill: '#94a3b8', fontSize: 12}} />
              <YAxis tick={{fill: '#94a3b8', fontSize: 12}} />
              <Tooltip
                contentStyle={{background: '#1e293b', border: '1px solid #334155', borderRadius: 8}}
                labelStyle={{color: '#f1f5f9'}}
              />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Spending by Category */}
        <div className="card">
          <h3 className="card-title">Spending by Category</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{background: '#1e293b', border: '1px solid #334155', borderRadius: 8}}
                  formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                />
                <Legend
                  formatter={(value) => <span style={{color:'#94a3b8', fontSize:12}}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">
              <p>No expense data for this month</p>
            </div>
          )}
        </div>
      </div>

      {/* Savings trend */}
      <div className="card" style={{marginBottom: 24}}>
        <h3 className="card-title">Savings Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={cashflow} margin={{top: 5, right: 5, left: 5, bottom: 5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="month" tick={{fill: '#94a3b8', fontSize: 12}} />
            <YAxis tick={{fill: '#94a3b8', fontSize: 12}} />
            <Tooltip
              contentStyle={{background: '#1e293b', border: '1px solid #334155', borderRadius: 8}}
            />
            <Line
              type="monotone"
              dataKey="savings"
              name="Savings"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{fill: '#6366f1', r: 4}}
              activeDot={{r: 6}}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="dashboard-bottom">
        {/* Recent Transactions */}
        <div className="card">
          <h3 className="card-title">Recent Transactions</h3>
          {recentTx.length > 0 ? (
            <div className="recent-tx-list">
              {recentTx.map(tx => (
                <div key={tx._id} className="tx-item">
                  <div className="tx-category-icon">
                    {getCategoryIcon(tx.category)}
                  </div>
                  <div className="tx-details">
                    <p className="tx-category">{tx.category}</p>
                    <p className="tx-desc">{tx.description || 'No description'}</p>
                  </div>
                  <div className="tx-right">
                    <p className={`tx-amount ${tx.type === 'income' ? 'text-success' : 'text-danger'}`}>
                      {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                    <p className="tx-date">{new Date(tx.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted" style={{textAlign:'center', padding: '16px 0'}}>
              No transactions yet
            </p>
          )}
        </div>

        {/* Budget Progress */}
        <div className="card">
          <h3 className="card-title">Budget Progress</h3>
          {budgets.length > 0 ? (
            <div className="budget-list">
              {budgets.slice(0, 5).map(b => (
                <div key={b._id} className="budget-item">
                  <div className="flex justify-between" style={{marginBottom: 6}}>
                    <span style={{fontSize: 14, fontWeight: 500}}>{b.category}</span>
                    <span style={{fontSize: 13, color: 'var(--text-secondary)'}}>
                      ₹{b.spent.toLocaleString('en-IN')} / ₹{Number(b.limit).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(100, (b.spent / b.limit) * 100)}%`,
                        background: b.spent > b.limit ? 'var(--danger)' :
                          b.spent / b.limit > 0.8 ? 'var(--warning)' : 'var(--primary)',
                      }}
                    />
                  </div>
                  <p style={{fontSize: 11, color: 'var(--text-secondary)', marginTop: 4}}>
                    {Math.round((b.spent / b.limit) * 100)}% used
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted" style={{textAlign:'center', padding: '16px 0'}}>
              No budgets set
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const getCategoryIcon = (category) => {
  const icons = {
    'Food & Dining': '🍔', 'Transport': '🚗', 'Shopping': '🛍️',
    'Entertainment': '🎬', 'Healthcare': '💊', 'Utilities': '⚡',
    'Housing': '🏠', 'Education': '📚', 'Travel': '✈️',
    'Investment': '📈', 'Salary': '💼', 'Freelance': '💻',
    'Business': '🏢', 'Other': '💰',
  };
  return icons[category] || '💳';
};

export default Dashboard;
