import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { toast } from 'react-toastify';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

const Reports = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [month, year]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/transactions/summary/monthly?month=${month}&year=${year}`);
      setSummary(res.data.data);
    } catch (err) {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const res = await axios.get(`/api/reports/export/${format}?month=${month}&year=${year}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial_report_${month}_${year}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} report downloaded`);
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const transactedIncome = summary?.summary?.find(s => s._id === 'income')?.total || 0;
  const totalIncome = transactedIncome > 0 ? transactedIncome : (summary?.monthlyIncome || 0);
  const totalExpenses = summary?.summary?.find(s => s._id === 'expense')?.total || 0;
  const pieData = summary?.categoryBreakdown?.map(c => ({ name: c._id, value: Math.round(c.total * 100) / 100 })) || [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Financial insights and export</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <select className="form-select" style={{ width: 120 }} value={month}
            onChange={e => setMonth(parseInt(e.target.value))}>
            {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select className="form-select" style={{ width: 90 }} value={year}
            onChange={e => setYear(parseInt(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}>
            📄 PDF
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('excel')}>
            📊 Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>💰</div>
          <div className="stat-content">
            <h3>Total Income</h3>
            <div className="stat-value text-success">₹{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>💸</div>
          <div className="stat-content">
            <h3>Total Expenses</h3>
            <div className="stat-value text-danger">₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.15)' }}>💎</div>
          <div className="stat-content">
            <h3>Net Savings</h3>
            <div className={`stat-value ${totalIncome - totalExpenses >= 0 ? 'text-success' : 'text-danger'}`}>
              ₹{(totalIncome - totalExpenses).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>📊</div>
          <div className="stat-content">
            <h3>Savings Rate</h3>
            <div className="stat-value text-warning">
              {totalIncome > 0 ? ((((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(1)) : '0.0'}%
            </div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        {/* Pie chart */}
        <div className="card">
          <h3 className="card-title">Spending Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100}
                  paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, '']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              No expense data available
            </div>
          )}
        </div>

        {/* Bar chart */}
        <div className="card">
          <h3 className="card-title">Category Breakdown</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={pieData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, '']} />
                <Bar dataKey="value" name="Amount" radius={[0, 4, 4, 0]}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Category table */}
      {pieData.length > 0 && (
        <div className="card">
          <h3 className="card-title">Detailed Breakdown</h3>
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>% of Total</th>
                  <th>Visual</th>
                </tr>
              </thead>
              <tbody>
                {pieData.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                        {item.name}
                      </div>
                    </td>
                    <td>₹{item.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>{totalExpenses > 0 ? ((item.value / totalExpenses) * 100).toFixed(1) : 0}%</td>
                    <td style={{ width: '30%' }}>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{
                          width: `${totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0}%`,
                          background: COLORS[i % COLORS.length],
                        }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
