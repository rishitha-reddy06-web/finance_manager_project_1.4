import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './ReceiptScanModal.css';

const CATEGORIES = [
    'Food & Dining', 'Transport', 'Shopping', 'Entertainment', 'Healthcare',
    'Utilities', 'Housing', 'Education', 'Travel', 'Investment',
    'Salary', 'Freelance', 'Business', 'Insurance', 'EMI & Loans',
    'Subscriptions', 'Gifts & Donations', 'Bank Charges', 'Other',
];

const ReceiptScanModal = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState('upload'); // 'upload', 'scanning', 'review'
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [items, setItems] = useState([]);
    const [metadata, setMetadata] = useState({
        merchant: '',
        date: new Date().toISOString().slice(0, 10),
        paymentMethod: 'card'
    });

    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const selected = e.target.files?.[0];
        if (!selected) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
            setError('Only JPG, PNG or WEBP images are supported.');
            return;
        }
        if (selected.size > 10 * 1024 * 1024) {
            setError('File size must be under 10MB.');
            return;
        }
        setError(null);
        setFile(selected);
        const url = URL.createObjectURL(selected);
        setPreviewUrl(url);
        setStep('upload');
    };

    const clearFile = () => {
        setFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setStep('upload');
    };

    const handleSaveImage = () => {
        if (!previewUrl) return;
        const link = document.createElement('a');
        link.href = previewUrl;
        link.download = `receipt_${metadata.date || 'scan'}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Receipt image saved!');
    };

    const handleAddItem = () => {
        setItems(prev => [...prev, {
            id: Date.now(),
            description: '',
            amount: 0,
            category: 'Other',
            type: 'expense'
        }]);
    };

    const handleScan = async () => {
        if (!file) return;
        setStep('scanning');
        setError(null);
        const formData = new FormData();
        formData.append('receipt', file);

        try {
            const res = await axios.post('/api/transactions/scan-receipt', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const { data } = res.data;

            setMetadata({
                merchant: data.merchant || '',
                date: data.date || new Date().toISOString().slice(0, 10),
                paymentMethod: 'card'
            });

            if (data.items && data.items.length > 0) {
                setItems(data.items.map((item, idx) => ({
                    ...item,
                    id: Date.now() + idx,
                    description: item.description || `Item ${idx + 1}`
                })));
            } else {
                setItems([{
                    id: Date.now(),
                    description: data.merchant || 'Purchase',
                    amount: data.amount || 0,
                    category: data.category || 'Other',
                    type: 'expense'
                }]);
            }

            setStep('review');
            toast.success('Receipt scanned successfully!');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to scan receipt image.');
            setStep('upload');
        }
    };

    const handleUpdateItem = (id, field, value) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const handleRemoveItem = (id) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const handleSubmitTransactions = async (e) => {
        e.preventDefault();
        const validItems = items.filter(item => item.description && parseFloat(item.amount) > 0);
        if (validItems.length === 0) {
            setError("Please add at least one item with description and amount.");
            return;
        }
        setIsSaving(true);
        setError(null);

        try {
            const payload = {
                transactions: validItems.map(item => ({
                    description: `${metadata.merchant}: ${item.description}`.substring(0, 200),
                    amount: parseFloat(item.amount) || 0,
                    category: item.category,
                    date: metadata.date,
                    type: 'expense',
                    paymentMethod: metadata.paymentMethod,
                    importSource: 'receipt'
                }))
            };

            await axios.post('/api/transactions/bulk', payload);
            
            toast.success(`Successfully added ${validItems.length} transactions`);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving transactions');
            setIsSaving(false);
        }
    };

    return (
        <div className="receipt-modal-overlay">
            <div className="receipt-modal-container">
                {/* Left Side: Receipt Preview */}
                <div className="receipt-preview-section">
                    <div className="preview-header">
                        <span className="preview-title">Receipt Preview</span>
                        {previewUrl && (
                            <button className="save-btn" onClick={handleSaveImage} title="Save Receipt Image">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7,10 12,15 17,10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Save
                            </button>
                        )}
                    </div>

                    <div className="preview-area">
                        {step === 'upload' && !file && (
                            <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()}>
                                <div className="upload-icon">📸</div>
                                <h3>Drop Receipt Image Here</h3>
                                <p>Click to browse or drag and drop</p>
                                <span className="upload-hint">JPG, PNG, WEBP up to 10MB</span>
                            </div>
                        )}

                        {file && (
                            <div className={`image-container ${step === 'scanning' ? 'scanning-active' : ''}`}>
                                <div className="scroll-wrapper">
                                    <img src={previewUrl} alt="Receipt" className="receipt-image" />
                                </div>
                                {step === 'upload' && (
                                    <button className="clear-btn" onClick={clearFile}>&times;</button>
                                )}
                                {step === 'scanning' && (
                                    <div className="scanning-overlay">
                                        <div className="scanner-line"></div>
                                        <div className="spinner"></div>
                                        <span>EXTRACTING ITEMS...</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                </div>

                {/* Right Side: Form & Items */}
                <div className="receipt-form-section">
                    <div className="form-header">
                        <div>
                            <h2>Smart Receipt Scanner</h2>
                            <p>POWERED BY TESSERACT OCR</p>
                        </div>
                        <button className="close-btn" onClick={onClose}>&times;</button>
                    </div>

                    {error && <div className="error-box">{error}</div>}

                    {(step === 'upload' || step === 'scanning') && (
                        <div className="steps-container">
                            <div className="step">
                                <div className="step-number">1</div>
                                <div className="step-content">
                                    <h4>Upload Receipt Image</h4>
                                    <p>Take a clear photo of your store receipt</p>
                                </div>
                            </div>
                            <div className="step">
                                <div className="step-number">2</div>
                                <div className="step-content">
                                    <h4>AI Line-Item Scan</h4>
                                    <p>We'll identify every item and categorize it</p>
                                </div>
                            </div>
                            <div className="step">
                                <div className="step-number">3</div>
                                <div className="step-content">
                                    <h4>Confirm & Save</h4>
                                    <p>Review transactions and save to your account</p>
                                </div>
                            </div>

                            <button
                                className="scan-btn"
                                onClick={handleScan}
                                disabled={!file || step === 'scanning'}
                            >
                                {step === 'scanning' ? 'SCANNING...' : 'START SCAN'}
                            </button>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="review-container">
                            {/* Metadata */}
                            <div className="metadata-grid">
                                <div className="metadata-field">
                                    <label>Store / Merchant</label>
                                    <input type="text" value={metadata.merchant} onChange={e => setMetadata({ ...metadata, merchant: e.target.value })} />
                                </div>
                                <div className="metadata-field">
                                    <label>Date</label>
                                    <input type="date" value={metadata.date} onChange={e => setMetadata({ ...metadata, date: e.target.value })} />
                                </div>
                                <div className="metadata-field">
                                    <label>Payment</label>
                                    <select value={metadata.paymentMethod} onChange={e => setMetadata({ ...metadata, paymentMethod: e.target.value })}>
                                        <option value="card">Card</option>
                                        <option value="cash">Cash</option>
                                        <option value="bank_transfer">Bank</option>
                                        <option value="upi">UPI</option>
                                    </select>
                                </div>
                            </div>

                            {/* Items List */}
                            <div className="items-list">
                                <div className="items-header">
                                    <span>Detected Items ({items.length})</span>
                                    <button className="add-item-btn" onClick={handleAddItem}>+ Add Item</button>
                                </div>
                                <div className="items-scroll">
                                    {items.map(item => (
                                        <div key={item.id} className="item-row">
                                            <button className="remove-item-btn" onClick={() => handleRemoveItem(item.id)}>&times;</button>
                                            <div className="item-field item-name">
                                                <label>Item</label>
                                                <input type="text" value={item.description} onChange={e => handleUpdateItem(item.id, 'description', e.target.value)} placeholder="Item name" />
                                            </div>
                                            <div className="item-field item-category">
                                                <label>Category</label>
                                                <select value={item.category} onChange={e => handleUpdateItem(item.id, 'category', e.target.value)}>
                                                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div className="item-field item-amount">
                                                <label>Amount</label>
                                                <div className="amount-input">
                                                    <span>₹</span>
                                                    <input type="number" value={item.amount} step="0.01" onChange={e => handleUpdateItem(item.id, 'amount', e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="form-actions">
                                <button className="back-btn" onClick={() => setStep('upload')}>BACK</button>
                                <button
                                    className="save-items-btn"
                                    onClick={handleSubmitTransactions}
                                    disabled={isSaving || items.length === 0}
                                >
                                    {isSaving ? 'SAVING...' : `SAVE ${items.length} ITEMS`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReceiptScanModal;
