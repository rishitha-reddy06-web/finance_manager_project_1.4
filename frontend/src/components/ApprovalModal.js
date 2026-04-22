import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const ApprovalModal = ({ data, onApproved, onDismiss }) => {
  const [loading, setLoading] = useState(false);
  const [editedData, setEditedData] = useState({ ...data });

  const handleApprove = async () => {
    setLoading(true);
    try {
      await axios.post('/api/transactions', {
        type: editedData.type,
        amount: editedData.amount,
        category: editedData.category,
        description: `${editedData.description} [AI-Synced]`,
        date: new Date().toISOString().slice(0, 10),
        paymentMethod: editedData.rawMessage?.toLowerCase().includes('upi') ? 'upi' : 'card'
      });
      toast.success('AI Detection Approved & Saved!');
      onApproved();
    } catch (err) {
      toast.error('Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="modal" style={{ maxWidth: 450, animation: 'slideUp 0.3s ease-out' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.5rem' }}>🤖</span>
            <h3 className="modal-title" style={{ color: '#10b981' }}>Confirm AI Detection</h3>
          </div>
          <button className="modal-close" onClick={onDismiss}>×</button>
        </div>
        
        <div style={{ padding: '20px 0' }}>
          <div className="card" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px dashed #10b981', marginBottom: 20 }}>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', margin: '0 0 10px 0' }}>MESSAGE ANALYZED:</p>
            <p style={{ fontStyle: 'italic', fontSize: '0.9rem', color: '#cbd5e1' }}>"{data.rawMessage}"</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Amount:</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: data.type === 'income' ? '#10b981' : '#f43f5e' }}>
                ₹{data.amount.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem' }}>Merchant / Description</label>
              <input 
                className="form-input" 
                value={editedData.description}
                onChange={e => setEditedData({ ...editedData, description: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem' }}>AI Suggested Category</label>
              <select 
                className="form-select" 
                value={editedData.category}
                onChange={e => setEditedData({ ...editedData, category: e.target.value })}
              >
                {['Food & Dining', 'Shopping', 'Transport', 'Healthcare', 'Utilities', 'Entertainment', 'Salary', 'Other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: 'none', gap: 12 }}>
          <button className="btn btn-secondary" onClick={onDismiss} style={{ flex: 1 }}>Discard</button>
          <button 
            className="btn btn-primary" 
            onClick={handleApprove} 
            disabled={loading}
            style={{ flex: 2, background: '#10b981' }}
          >
            {loading ? 'Syncing...' : 'Approve & Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;
