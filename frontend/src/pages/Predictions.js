import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { toast } from 'react-toastify';

const Predictions = () => {
  const [expensePred, setExpensePred] = useState(null);
  const [savings, setSavings] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [predRes, savRes, recRes] = await Promise.all([
        axios.get('/api/predictions/expenses'),
        axios.get('/api/predictions/savings?months=12'),
        axios.get('/api/predictions/recommendations'),
      ]);
      setExpensePred(predRes.data.data);
      setSavings(savRes.data.data);
      setRecommendations(recRes.data.data);
    } catch (err) {
      toast.error('Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  const recTypeColors = { warning: 'var(--warning)', info: 'var(--info)', success: 'var(--secondary)' };
  const recTypeIcons = { warning: '⚠️', info: 'ℹ️', success: '✅' };

  if (loading) return (
    <div className="fade-in">
      <div className="page-header"><h1 className="page-title">AI Predictions</h1></div>
      <div className="stats-grid">
        {[1,2,3].map(i => <div key={i} className="card skeleton" style={{height: 100}} />)}
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🤖 AI Predictions</h1>
          <p className="page-subtitle">Powered by machine learning • {expensePred?.method}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll}>🔄 Refresh</button>
      </div>

      {/* Key metrics */}
      {savings && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{background:'rgba(99,102,241,0.15)'}}>💰</div>
            <div className="stat-content">
              <h3>Avg Monthly Income</h3>
              <div className="stat-value">₹{savings.avgMonthlyIncome?.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{background:'rgba(239,68,68,0.15)'}}>💸</div>
            <div className="stat-content">
              <h3>Avg Monthly Expenses</h3>
              <div className="stat-value text-danger">₹{savings.avgMonthlyExpenses?.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{background:'rgba(16,185,129,0.15)'}}>📈</div>
            <div className="stat-content">
              <h3>Avg Monthly Savings</h3>
              <div className={`stat-value ${savings.avgMonthlySavings >= 0 ? 'text-success' : 'text-danger'}`}>
                ₹{savings.avgMonthlySavings?.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
            </div>
          </div>
          {savings.monthsToGoal && (
            <div className="stat-card">
              <div className="stat-icon" style={{background:'rgba(245,158,11,0.15)'}}>🎯</div>
              <div className="stat-content">
                <h3>Months to Goal</h3>
                <div className="stat-value text-warning">{savings.monthsToGoal}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="charts-grid">
        {/* Expense Forecast */}
        {expensePred?.predictions && (
          <div className="card">
            <h3 className="card-title">📊 3-Month Expense Forecast</h3>
            <p className="text-muted" style={{fontSize: 13, marginBottom: 16}}>{expensePred.message}</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={expensePred.predictions}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{fill:'#94a3b8', fontSize:12}} />
                <YAxis tick={{fill:'#94a3b8', fontSize:12}} />
                <Tooltip contentStyle={{background:'#1e293b', border:'1px solid #334155', borderRadius:8}} />
                <Bar dataKey="predicted" name="Predicted Expenses" fill="#6366f1" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Savings Projection */}
        {savings?.projections && (
          <div className="card">
            <h3 className="card-title">📈 12-Month Savings Projection</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={savings.projections}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{fill:'#94a3b8', fontSize:10}} interval={1} />
                <YAxis tick={{fill:'#94a3b8', fontSize:12}} />
                <Tooltip contentStyle={{background:'#1e293b', border:'1px solid #334155', borderRadius:8}} />
                <Legend />
                {savings.savingsGoal > 0 && (
                  <ReferenceLine y={savings.savingsGoal} stroke="#f59e0b"
                    strokeDasharray="5 5" label={{value:'Goal', fill:'#f59e0b', fontSize:11}} />
                )}
                <Line type="monotone" dataKey="cumulativeSavings" name="Cumulative Savings"
                  stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="monthlySavings" name="Monthly Savings"
                  stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Goal progress */}
      {savings?.savingsGoal > 0 && savings?.projections && (
        <div className="card" style={{marginBottom: 24}}>
          <h3 className="card-title">🎯 Savings Goal Progress</h3>
          <div className="flex items-center gap-4" style={{marginBottom: 12}}>
            <span style={{fontSize: 14}}>Goal: ₹{savings.savingsGoal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            {savings.monthsToGoal && (
              <span className="badge badge-warning">~{savings.monthsToGoal} months to reach goal</span>
            )}
          </div>
          <div className="progress-bar" style={{height: 12}}>
            <div className="progress-fill" style={{
              width: `${Math.min(100, ((savings.avgMonthlySavings || 0) / savings.savingsGoal) * 100 * 3)}%`,
              background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
            }} />
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="card">
        <h3 className="card-title">💡 Personalized Recommendations</h3>
        <div style={{display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8}}>
          {recommendations.map((rec, i) => (
            <div key={i} className="rec-item" style={{
              padding: 16, borderRadius: 10,
              background: 'var(--bg)',
              borderLeft: `4px solid ${recTypeColors[rec.type] || 'var(--primary)'}`,
            }}>
              <div className="flex items-center gap-3" style={{marginBottom: 6}}>
                <span style={{fontSize: 18}}>{recTypeIcons[rec.type]}</span>
                <strong style={{fontSize: 14, color: 'var(--text-primary)'}}>{rec.category}</strong>
                {rec.potentialSavings > 0 && (
                  <span className="badge badge-income" style={{marginLeft: 'auto'}}>
                    Save ₹{Number(rec.potentialSavings).toLocaleString('en-IN')}/mo
                  </span>
                )}
              </div>
              <p style={{fontSize: 13, color: 'var(--text-secondary)'}}>{rec.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Predictions;
