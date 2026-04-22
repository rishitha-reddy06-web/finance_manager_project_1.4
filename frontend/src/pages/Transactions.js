import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import PdfImportModal from '../components/PdfImportModal';
import ReceiptScanModal from '../components/ReceiptScanModal';
import VoiceControlPanel from '../components/VoiceControlPanel';
import ApprovalModal from '../components/ApprovalModal';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';

const CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment', 'Healthcare',
  'Utilities', 'Housing', 'Education', 'Travel', 'Investment',
  'Salary', 'Freelance', 'Business', 'Insurance', 'EMI & Loans',
  'Subscriptions', 'Gifts & Donations', 'Personal Care', 'Bank Charges', 'Other',
];

const TransactionModal = ({ tx, onClose, onSave }) => {
  const [form, setForm] = useState(tx || {
    type: 'expense', amount: '', category: 'Food & Dining',
    description: '', date: new Date().toISOString().slice(0, 10),
    paymentMethod: 'card', isRecurring: false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tx?._id) {
        await axios.put(`/api/transactions/${tx._id}`, form);
        toast.success('Transaction updated');
      } else {
        await axios.post('/api/transactions', form);
        toast.success('Transaction added');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{tx?._id ? 'Edit Transaction' : 'Add Transaction'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Type</label>
            <div className="type-toggle">
              <button type="button" className={`type-btn ${form.type === 'expense' ? 'active-expense' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, type: 'expense' }))}>
                💸 Expense
              </button>
              <button type="button" className={`type-btn ${form.type === 'income' ? 'active-income' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, type: 'income' }))}>
                💰 Income
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Amount</label>
            <input type="number" className="form-input" placeholder="0.00" step="0.01" min="0.01"
              value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Category</label>
            <select className="form-select" value={form.category}
              onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input type="text" className="form-input" placeholder="Optional description"
              value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Date</label>
            <input type="date" className="form-input" value={form.date}
              onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Payment Method</label>
            <select className="form-select" value={form.paymentMethod}
              onChange={e => setForm(prev => ({ ...prev, paymentMethod: e.target.value }))}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: 'auto' }}>
              {loading ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Transactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [modal, setModal] = useState(null);
  const [pdfImportModal, setPdfImportModal] = useState(false);
  const [receiptScanModal, setReceiptScanModal] = useState(false);
  const [filters, setFilters] = useState({ type: '', category: '', search: '', startDate: '', endDate: '', paymentMethod: '' });
  const [loading, setLoading] = useState(true);
  const [approvalData, setApprovalData] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Initial fetch and fetch on filter change
  useEffect(() => {
    fetchTransactions(1);
    setCurrentPage(1);
  }, [filters]);

  // Fetch when page changes
  useEffect(() => {
    fetchTransactions(currentPage);
  }, [currentPage]);

  useEffect(() => {
    // Setup Autonomous Listener (Socket.io)
    const socket = io('http://localhost:5000');
    if (user) {
      socket.emit('join', user.id || user._id);
      
      socket.on('new_detection_for_approval', (detection) => {
        setApprovalData(detection);
      });
      
      socket.on('new_transaction_autonomous', (newTx) => {
        toast.info(`🤖 AI Background Sync: Added ₹${newTx.amount} from SMS`, {
          position: "top-center",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          theme: "colored",
        });
        fetchTransactions(currentPage);
      });
    }

    return () => socket.disconnect();
  }, [user]);

  const fetchTransactions = async (pageToFetch = 1) => {
    setLoading(true);
    try {
      const { type, category, search, startDate, endDate, paymentMethod } = filters;
      let url = `/api/transactions?page=${pageToFetch}&limit=10`;
      if (type) url += `&type=${type}`;
      if (category) url += `&category=${category}`;
      if (search) url += `&search=${search}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (paymentMethod) url += `&paymentMethod=${paymentMethod}`;

      const res = await axios.get(url);
      setTransactions(res.data.data);
      setTotalPages(res.data.pages || 1);
      setTotalCount(res.data.total || 0);
    } catch (err) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await axios.delete(`/api/transactions/${id}`);
      toast.success('Transaction deleted');
      fetchTransactions(currentPage);
    } catch (err) {
      toast.error('Failed to delete');
    }
  };


  const handlePdfImportSuccess = () => {
    setPdfImportModal(false);
    setTimeout(() => {
      fetchTransactions();
    }, 1500);
  };

  const handleReceiptScanSuccess = () => {
    setReceiptScanModal(false);
    setTimeout(() => fetchTransactions(), 500);
  };

  return (
    <div className="fade-in">
      {approvalData && (
        <ApprovalModal 
          data={approvalData} 
          onApproved={() => { setApprovalData(null); fetchTransactions(); }}
          onDismiss={() => setApprovalData(null)}
        />
      )}

      {modal !== undefined && modal !== null && (
        <TransactionModal
          tx={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchTransactions(); }}
        />
      )}

      {pdfImportModal && (
        <PdfImportModal
          onClose={() => setPdfImportModal(false)}
          onSuccess={handlePdfImportSuccess}
        />
      )}

      {receiptScanModal && (
        <ReceiptScanModal
          onClose={() => setReceiptScanModal(false)}
          onSuccess={handleReceiptScanSuccess}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">{totalCount.toLocaleString()} total transactions</p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setReceiptScanModal(true)}
            title="Scan a receipt image using OCR"
          >
            📸 Scan Receipt
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPdfImportModal(true)}
            title="Import transactions from PDF bank statement"
          >
            📄 Import PDF
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>
            + Add Transaction
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="filters-grid">
          <input className="form-input" placeholder="🔍 Search..." value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })} />
          <select className="form-select" value={filters.type}
            onChange={e => setFilters({ ...filters, type: e.target.value })}>
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select className="form-select" value={filters.category}
            onChange={e => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="date" className="form-input" value={filters.startDate}
            onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
          <input type="date" className="form-input" value={filters.endDate}
            onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
          <select className="form-select" value={filters.paymentMethod}
            onChange={e => setFilters({ ...filters, paymentMethod: e.target.value })}>
            <option value="">All Payments</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
          <button className="btn btn-secondary btn-sm"
            onClick={() => setFilters({ type: '', category: '', search: '', startDate: '', endDate: '', paymentMethod: '' })}>
            Clear
          </button>
        </div>
      </div>

      {/* Voice Control Panel */}
      <VoiceControlPanel user={user} onTransactionAdded={fetchTransactions} />

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Type</th>
              <th>Payment</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(7).fill(0).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>
                  ))}
                </tr>
              ))
            ) : transactions.length > 0 ? (
              transactions.map(tx => (
                <tr key={tx._id}>
                  <td>{new Date(tx.date).toLocaleDateString()}</td>
                  <td>{tx.category}</td>
                  <td>{tx.description || '—'}</td>
                  <td>
                    <span className={`badge badge-${tx.type === 'income' ? 'income' : 'expense'}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{tx.paymentMethod}</td>
                  <td className={tx.type === 'income' ? 'text-success' : 'text-danger'} style={{ fontWeight: 600 }}>
                    {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={() => setModal(tx)}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(tx._id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pagination-controls" style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '1.5rem',
          marginTop: '2rem',
          padding: '1rem',
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: '12px'
        }}>
          <button 
            className="btn btn-secondary btn-sm" 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            style={{ minWidth: '100px' }}
          >
            ← Previous
          </button>
          
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
            Page <span style={{ color: 'var(--text-primary)' }}>{currentPage}</span> of <span style={{ color: 'var(--text-primary)' }}>{totalPages}</span>
          </span>

          <button 
            className="btn btn-secondary btn-sm" 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            style={{ minWidth: '100px' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default Transactions;
