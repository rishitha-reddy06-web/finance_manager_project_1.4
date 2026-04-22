import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const AiAssistant = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [displayText, setDisplayText] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchAnalysis();
  }, []);

  useEffect(() => {
    if (data?.summary) {
      let index = 0;
      setDisplayText('');
      const interval = setInterval(() => {
        setDisplayText((prev) => prev + data.summary[index]);
        index++;
        if (index >= data.summary.length) clearInterval(interval);
      }, 25);
      return () => clearInterval(interval);
    }
  }, [data?.summary]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ai-assistant/analysis');
      setData(res.data.data);
    } catch (err) {
      toast.error('AI analysis failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg = { role: 'user', content: chatMessage };
    setChatHistory(prev => [...prev, userMsg]);
    setChatMessage('');

    try {
      const res = await axios.post('/api/ai-assistant/chat', { message: chatMessage });
      setChatHistory(prev => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch (err) {
      toast.error('AI response failed');
    }
  };

  if (loading || !data) return <div className="loading-container">🤖 Assistant is thinking...</div>;

  return (
    <div className="fade-in assistant-page" style={{ paddingBottom: 100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">🧠 Intelligent AI Assistant</h1>
          <p className="page-subtitle">Personalized financial brain powered by Machine Learning</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAnalysis}>🔄 Refresh Analysis</button>
      </div>

      {/* Main AI Insight Hub */}
      <div className="card ai-insight-hub" style={{ 
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        marginBottom: 24,
        padding: 30
      }}>
        <div className="flex items-center gap-5 mb-5">
          <div className="ai-avatar-large">🤖</div>
          <div>
            <h2 style={{ margin: 0, color: '#fff' }}>Financial Status Report</h2>
            <div className="flex gap-4 mt-1">
              <span className={`badge badge-${data.risk?.level?.toLowerCase() || 'info'}`}>Risk: {data.risk?.level || 'Low'}</span>
              <span className="badge badge-info">Confidence: {(data.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
        <div className="ai-narrative-box">
          {displayText}<span className="typing-cursor">|</span>
        </div>
        
        {/* Suggestion Highlights */}
        {data.suggestions?.length > 0 && (
          <div className="mt-6 flex flex-col gap-3">
            {data.suggestions.map((s, i) => (
              <div key={i} className="suggestion-pill">
                <span className="pill-icon">💡</span>
                {s.message}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pattern Detection Cards */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="card">
            <h3 className="card-title">📅 Spending Patterns</h3>
            <div className="pattern-item">
              <p className="text-muted text-xs">WEEKEND VS WEEKDAY</p>
              <div className="flex justify-between items-end mt-2">
                <div>
                  <div className="text-xs text-muted">Weekday Avg</div>
                  <div className="font-bold">₹{data.patterns?.weekend_vs_weekday?.avgWeekday || 0}</div>
                </div>
                <div className="text-center px-2 py-1 bg-slate-800 rounded text-xs">
                  {data.patterns?.weekend_vs_weekday?.bias?.replace('_', ' ') || 'None'}
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted">Weekend Avg</div>
                  <div className="font-bold">₹{data.patterns?.weekend_vs_weekday?.avgWeekend || 0}</div>
                </div>
              </div>
            </div>
            <div className="pattern-item mt-6">
              <p className="text-muted text-xs">TOP CATEGORY</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="text-2xl">🔥</div>
                <div>
                  <div className="font-bold">{data.patterns?.highest_spending_category?.name || 'No data'}</div>
                  <div className="text-xs text-muted">₹{(data.patterns?.highest_spending_category?.amount || 0).toLocaleString()} this month</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">🛡️ Risk Engine</h3>
            <div className="text-center py-4">
              <div style={{ fontSize: 40, fontWeight: 800, color: data.risk.level === 'High' ? 'var(--danger)' : 'var(--secondary)' }}>
                {data.risk.probability}%
              </div>
              <p className="text-muted text-sm">Probability of exceeding budget</p>
            </div>
            <div className="progress-bar" style={{ height: 8 }}>
              <div className="progress-fill" style={{ 
                width: `${data.risk.probability}%`,
                background: data.risk.level === 'High' ? 'var(--danger)' : 'var(--secondary)'
              }} />
            </div>
          </div>
        </div>

        {/* Category Predictions Table/Cards */}
        <div className="lg:col-span-2">
          <div className="card">
            <h3 className="card-title">🎯 30-Day Category Predictions</h3>
            <div className="prediction-grid-mini">
              {data.category_predictions.map((p, i) => (
                <div key={i} className="mini-pred-card">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{p.category}</span>
                    <span className={`trend-tag ${p.trend}`}>
                      {p.trend === 'increase' ? '▲' : p.trend === 'decrease' ? '▼' : '▬'}
                    </span>
                  </div>
                  <div className="pred-value mt-2">₹{p.predicted_amount.toLocaleString()}</div>
                  <div className="text-xs text-muted mt-1">{p.confidence} Confidence</div>
                </div>
              ))}
            </div>
            
            <div className="mt-8" style={{ height: 300 }}>
              <h4 className="text-sm font-medium mb-4">Total Predicted Spend: ₹{data.total_predicted.toLocaleString()}</h4>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.category_predictions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="category" tick={{fill: '#94a3b8', fontSize: 11}} />
                  <YAxis tick={{fill: '#94a3b8', fontSize: 11}} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Bar dataKey="predicted_amount" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Chat Interface */}
      <div className="ai-chat-container">
        <div className="chat-header">
          <span>💬 Ask Assistant</span>
        </div>
        <div className="chat-messages">
          {chatHistory.length === 0 && (
            <div className="text-center p-4 text-xs text-muted">
              Ask me things like "How is my weekend spending?" or "Predict my next month"
            </div>
          )}
          {chatHistory.map((m, i) => (
            <div key={i} className={`chat-bubble ${m.role}`}>
              {m.content}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form className="chat-input-area" onSubmit={handleSendMessage}>
          <input 
            type="text" 
            placeholder="Type a question..." 
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
};

export default AiAssistant;
