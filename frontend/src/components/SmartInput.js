import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import naturalLanguageParser from '../services/naturalLanguageParser';

const SmartInput = ({ onTransactionAdded }) => {
  const [text, setText] = useState('');
  const [detected, setDetected] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);

    if (val.trim().length > 10) {
      const result = naturalLanguageParser.parse(val);
      if (result.success && (result.type === 'transaction' || result.type === 'sms')) {
        setDetected(result.data);
      } else {
        setDetected(null);
      }
    } else {
      setDetected(null);
    }
  };

  const handleSave = async () => {
    if (!detected) return;
    setLoading(true);
    try {
      await axios.post('/api/transactions', {
        ...detected,
        date: new Date().toISOString().slice(0, 10)
      });
      toast.success(`Detected & Added: ₹${detected.amount} for ${detected.description}`);
      setText('');
      setDetected(null);
      if (onTransactionAdded) onTransactionAdded();
    } catch (err) {
      toast.error('Failed to save detected transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card smart-input-card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem' }}>🤖</span>
          <h4 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: 600 }}>AI Smart Sync</h4>
          <span className="badge badge-income" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>Pasted Messages Support</span>
        </div>
        
        <div style={{ position: 'relative' }}>
          <textarea
            className="form-input"
            style={{ 
              width: '100%', 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: '#fff', 
              borderRadius: 12,
              padding: '12px 15px',
              minHeight: 80,
              resize: 'none',
              fontSize: '0.9rem'
            }}
            placeholder="Paste Bank SMS or type 'Spent 500 on coffee'..."
            value={text}
            onChange={handleTextChange}
          />
          
          {detected && (
            <div className="fade-in" style={{ 
              marginTop: 12, 
              padding: 12, 
              background: 'rgba(16, 185, 129, 0.1)', 
              border: '1px solid rgba(16, 185, 129, 0.2)', 
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>DETECTED TRANSACTION</p>
                <div style={{ display: 'flex', gap: 15, marginTop: 4 }}>
                  <span style={{ color: '#fff' }}><strong>₹{detected.amount}</strong></span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>•</span>
                  <span style={{ color: '#fff' }}>{detected.description}</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>•</span>
                  <span style={{ color: '#94a3b8' }}>{detected.category}</span>
                </div>
              </div>
              <button 
                onClick={handleSave}
                disabled={loading}
                className="btn btn-primary" 
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                {loading ? 'Adding...' : 'Save AI Detection'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartInput;
