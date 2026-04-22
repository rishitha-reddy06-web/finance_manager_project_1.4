import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const Predictions = () => {
  const { user } = useAuth();
  const [expensePred, setExpensePred] = useState(null);
  const [savings, setSavings] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState(null);

  useEffect(() => {
    fetchAll();
  }, [user?.monthlyIncome, user?.savingsGoal]);

  // Typing effect logic
  useEffect(() => {
    if (aiSummary) {
      let index = 0;
      setDisplayText('');
      const interval = setInterval(() => {
        setDisplayText((prev) => prev + aiSummary[index]);
        index++;
        if (index >= aiSummary.length) clearInterval(interval);
      }, 30);
      return () => clearInterval(interval);
    }
  }, [aiSummary]);

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

      // Use backend-generated AI narrative
      if (predRes.data.data.aiNarrative) {
        setAiSummary(predRes.data.data.aiNarrative);
      } else {
        setAiSummary("Your finances are looking great! Keep tracking to unlock deeper AI insights.");
      }
    } catch (err) {
      toast.error('Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  const trainModel = async () => {
    setTraining(true);
    setTrainResult(null);
    try {
      const res = await axios.post('/api/predictions/train');
      setTrainResult(res.data.data);
      toast.success(res.data.message);
      // Refresh predictions with newly trained models
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Training failed');
    } finally {
      setTraining(false);
    }
  };

  const recTypeColors = { warning: 'var(--warning)', info: 'var(--info)', success: 'var(--secondary)' };
  const recTypeIcons = { warning: '⚠️', info: 'ℹ️', success: '✅' };
  const riskColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
  const trendIcons = { increasing: '📈', decreasing: '📉', stable: '➡️' };

  const breakdown = expensePred?.predictions?.[0]?.breakdown || {};
  const topCategories = Object.entries(breakdown)
    .sort((a, b) => b[1].predicted_amount - a[1].predicted_amount)
    .slice(0, 6);

  if (loading) return (
    <div className="fade-in">
      <div className="page-header"><h1 className="page-title">AI Predictions</h1></div>
      <div className="stats-grid">
        {[1, 2, 3].map(i => <div key={i} className="card skeleton" style={{ height: 100 }} />)}
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
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={trainModel} disabled={training}>
            {training ? '⏳ Training...' : '🧠 Train Model'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={fetchAll}>🔄 Refresh</button>
        </div>
      </div>

      {/* AI Insight Hub with Typing Effect */}
      <div className="card ai-insight-hub" style={{ 
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        marginBottom: 24, position: 'relative', overflow: 'hidden'
      }}>
        <div className="flex items-center gap-4 mb-3">
          <div style={{ 
            width: 48, height: 48, borderRadius: '50%', 
            background: 'var(--primary)', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', fontSize: 24,
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)'
          }}>🤖</div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: '#fff' }}>AI Financial Assistant</h3>
            <span style={{ fontSize: 12, color: 'var(--primary)' }}>● Analyzing live data...</span>
          </div>
        </div>
        <div style={{ 
          background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.05)', minHeight: 80,
          lineHeight: 1.8, color: '#e2e8f0', fontSize: 14, whiteSpace: 'pre-line'
        }}>
          {displayText}<span className="typing-cursor">|</span>
        </div>
      </div>

      {/* Training Results */}
      {trainResult && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--primary)' }}>
          <div className="flex justify-between items-center mb-3">
            <h3 className="card-title" style={{ margin: 0 }}>🧠 Model Training Results</h3>
            <span className="badge badge-success">{trainResult.trained} models trained in {trainResult.duration_ms}ms</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {trainResult.categories?.map((cat, i) => (
              <div key={i} style={{ padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
                <p className="font-bold text-sm">{cat.name}</p>
                <p className="text-xs text-muted">R² Score: <strong style={{ color: cat.r2 > 70 ? '#10b981' : cat.r2 > 40 ? '#f59e0b' : '#ef4444' }}>{cat.r2}%</strong></p>
                <p className="text-xs text-muted">MAE: ₹{cat.mae?.toLocaleString()}</p>
                <p className="text-xs text-muted">Samples: {cat.samples}</p>
                <span className="badge" style={{ fontSize: 10, marginTop: 4, background: cat.confidence === 'High' ? '#10b98122' : cat.confidence === 'Medium' ? '#f59e0b22' : '#ef444422', color: cat.confidence === 'High' ? '#10b981' : cat.confidence === 'Medium' ? '#f59e0b' : '#ef4444' }}>
                  {cat.confidence} Confidence
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key metrics */}
      {savings && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.15)' }}>💰</div>
            <div className="stat-content">
              <h3>Avg Monthly Income</h3>
              <div className="stat-value">₹{savings.avgMonthlyIncome?.toLocaleString('en-IN')}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>💸</div>
            <div className="stat-content">
              <h3>Avg Monthly Expenses</h3>
              <div className="stat-value text-danger">₹{savings.avgMonthlyExpenses?.toLocaleString('en-IN')}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>📈</div>
            <div className="stat-content">
              <h3>Avg Monthly Savings</h3>
              <div className={`stat-value ${savings.avgMonthlySavings >= 0 ? 'text-success' : 'text-danger'}`}>
                ₹{savings.avgMonthlySavings?.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
          {savings.monthsToGoal && (
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>🎯</div>
              <div className="stat-content">
                <h3>Months to Goal</h3>
                <div className="stat-value text-warning">{savings.monthsToGoal}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category Prediction Cards */}
      {topCategories.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>🧠 Category Intelligence</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {topCategories.map(([cat, info]) => (
              <div key={cat} className="card" style={{ borderLeft: `4px solid ${riskColors[info.risk_level]}` }}>
                <div className="flex justify-between items-center mb-2">
                  <strong style={{ fontSize: 15 }}>{cat}</strong>
                  <span style={{ fontSize: 20 }}>{trendIcons[info.trend]}</span>
                </div>
                <div className="text-2xl font-bold mb-2">₹{info.predicted_amount?.toLocaleString()}</div>
                <div className="flex gap-2 flex-wrap mb-3">
                  <span className="badge" style={{ background: `${riskColors[info.risk_level]}22`, color: riskColors[info.risk_level] }}>
                    {info.risk_level} risk
                  </span>
                  <span className="badge badge-secondary">
                    {info.pct_change > 0 ? '+' : ''}{info.pct_change}% vs last
                  </span>
                  <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                    {info.confidence_label} confidence
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  <strong>Why:</strong> {info.reason}
                </p>
                <p style={{ fontSize: 12, color: riskColors[info.risk_level], marginBottom: 8 }}>
                  {info.risk_narrative}
                </p>
                {info.suggestions?.map((s, i) => (
                  <p key={i} style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 10, borderLeft: '2px solid #334155', marginBottom: 4 }}>
                    💡 {s}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="charts-grid">
        {/* Expense Forecast Chart */}
        {expensePred?.predictions && (
          <div className="card">
            <h3 className="card-title">📊 Next-Month Category Forecast</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart 
                layout="vertical"
                data={topCategories.map(([cat, info]) => ({
                  category: cat,
                  amount: info.predicted_amount,
                }))}
                margin={{ left: 40, right: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis dataKey="category" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                <Bar dataKey="amount" name="Predicted ₹" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
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
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={1} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                <Legend />
                {savings.savingsGoal > 0 && (
                  <ReferenceLine y={savings.savingsGoal} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Goal', fill: '#f59e0b', fontSize: 11 }} />
                )}
                <Line type="monotone" dataKey="cumulativeSavings" name="Cumulative Savings" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="monthlySavings" name="Monthly Savings" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Pattern Insights */}
      {expensePred?.patternInsights && (
        <div className="card" style={{ marginBottom: 24, marginTop: 24 }}>
          <h3 className="card-title">🔍 Behavioral Pattern Insights</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16, marginTop: 12 }}>
            {expensePred.patternInsights.weekendVsWeekday && (
              <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 10 }}>
                <p className="text-xs text-muted mb-1">🗓️ Weekend vs Weekday</p>
                <p className="font-bold">Weekday: ₹{expensePred.patternInsights.weekendVsWeekday.avgWeekday?.toLocaleString()}</p>
                <p className="font-bold">Weekend: ₹{expensePred.patternInsights.weekendVsWeekday.avgWeekend?.toLocaleString()}</p>
                <p className="text-xs text-muted mt-1">Bias: {expensePred.patternInsights.weekendVsWeekday.bias}</p>
              </div>
            )}
            {expensePred.patternInsights.fastestGrowing && (
              <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 10 }}>
                <p className="text-xs text-muted mb-1">🚀 Fastest Growing</p>
                <p className="font-bold">{expensePred.patternInsights.fastestGrowing.category}</p>
                <p className="text-danger text-sm">+{expensePred.patternInsights.fastestGrowing.growthRate}% growth</p>
              </div>
            )}
            {expensePred.patternInsights.spikes?.length > 0 && (
              <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 10 }}>
                <p className="text-xs text-muted mb-1">⚡ Unusual Spikes</p>
                {expensePred.patternInsights.spikes.map((s, i) => (
                  <p key={i} className="text-sm"><strong>{s.category}</strong>: +{s.growthRate}%</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Goal progress */}
      {savings?.savingsGoal > 0 && savings?.projections && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="card-title">🎯 Savings Goal Progress</h3>
          <div className="flex items-center gap-4" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 14 }}>Goal: ₹{savings.savingsGoal.toLocaleString('en-IN')}</span>
            {savings.monthsToGoal && (
              <span className="badge badge-warning">~{savings.monthsToGoal} months to reach goal</span>
            )}
          </div>
          <div className="progress-bar" style={{ height: 12 }}>
            <div className="progress-fill" style={{
              width: `${Math.min(100, ((savings.avgMonthlySavings || 0) / savings.savingsGoal) * 100 * 3)}%`,
              background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
            }} />
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="card">
        <h3 className="card-title">💡 Detailed Recommendations</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {recommendations.map((rec, i) => (
            <div key={i} className="rec-item" style={{
              padding: 16, borderRadius: 10, background: 'var(--bg)',
              borderLeft: `4px solid ${recTypeColors[rec.type] || 'var(--primary)'}`,
            }}>
              <div className="flex items-center gap-3" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{recTypeIcons[rec.type]}</span>
                <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{rec.category}</strong>
                {rec.potentialSavings > 0 && (
                  <span className="badge badge-income" style={{ marginLeft: 'auto' }}>
                    Save ₹{Number(rec.potentialSavings).toLocaleString('en-IN')}/mo
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{rec.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Predictions;
