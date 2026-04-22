import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

/**
 * PdfImportModal Component
 * Handles PDF bank statement upload with:
 * - Format detection and validation
 * - Duplicate detection and prevention
 * - Transaction preview
 * - Detailed error handling and suggestions
 */
const PdfImportModal = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [step, setStep] = useState('upload'); // 'upload', 'preview', 'success', 'error'
  const [error, setError] = useState(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Basic file validation
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a PDF file');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a PDF file');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/api/transactions/import-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        },
      });

      if (res.data.success) {
        setPreviewData(res.data.data);
        toast.success('✅ ' + res.data.message);
        setStep('success');

        // Notify parent component about successful import
        setTimeout(() => {
          if (onSuccess) onSuccess(res.data.data);
        }, 2000);
      }
    } catch (err) {
      const errorData = err.response?.data;
      setError({
        title: errorData?.message || 'Failed to import PDF',
        details: errorData?.errors || [err.message],
        suggestions: errorData?.suggestions || [],
        duplicates: errorData?.duplicates || [],
        duplicateCount: errorData?.duplicateCount || 0,
        textPreview: errorData?.textPreview || null,
        bankDetected: errorData?.bankDetected || null,
        isScanned: errorData?.isScanned || false,
      });
      setStep('error');
      toast.error(errorData?.message || 'Import failed');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const renderUploadStep = () => (
    <div className="upload-container" style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div
        className="upload-zone"
        style={{
          border: '2px dashed var(--border-color)',
          borderRadius: '8px',
          padding: '40px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          backgroundColor: 'var(--bg-secondary)',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const droppedFile = e.dataTransfer.files[0];
          if (droppedFile?.name.toLowerCase().endsWith('.pdf')) {
            setFile(droppedFile);
          } else {
            toast.error('Please drop a PDF file');
          }
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
        <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Upload Bank Statement</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Drag and drop your PDF here or click to browse
        </p>
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          id="pdf-input"
        />
        <label htmlFor="pdf-input" style={{ cursor: 'pointer' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => document.getElementById('pdf-input').click()}
          >
            Select PDF File
          </button>
        </label>
      </div>

      {file && (
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <p style={{ marginBottom: '12px' }}>
            <strong>Selected file:</strong> {file.name}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Size: {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setFile(null)}
            >
              Change File
            </button>
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={loading}
            >
              {loading ? `⏳ Uploading (${uploadProgress}%)` : '📤 Upload & Parse'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '24px', textAlign: 'left', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
        <h4 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Supported Banks</h4>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          HDFC, ICICI, SBI, Axis, Yes, Kotak, IDBI, and most other banks
        </p>
        <h4 style={{ marginBottom: '8px', color: 'var(--text-primary)', marginTop: '12px' }}>Supported Formats</h4>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          ✓ Text-based PDFs (not scanned images)<br />
          ✓ Statement of Accounts<br />
          ✓ Account Statements<br />
          ✓ Transaction Details reports
        </p>
      </div>
    </div>
  );

const renderErrorStep = () => {
    const isScanned = error?.isScanned;
    
    return (
      <div style={{ padding: '20px' }}>
        {isScanned ? (
          <div style={{ padding: '16px', backgroundColor: '#fff3cd', borderRadius: '8px', marginBottom: '16px', border: '1px solid #ffc107' }}>
            <h3 style={{ color: '#856404', marginBottom: '8px' }}>📷 Scanned PDF Detected</h3>
            <p style={{ fontSize: '14px', color: '#856404', marginBottom: '12px' }}>
              This PDF appears to be a scanned image. Text cannot be extracted from image-based PDFs.
            </p>
            <div style={{ fontSize: '12px', color: '#856404', padding: '12px', backgroundColor: '#fff', borderRadius: '4px' }}>
              <strong>To fix this:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px' }}>
                <li>Download a fresh bank statement as a text-based PDF from your bank's website</li>
                <li>Use OCR software to convert the scanned PDF to text</li>
                <li>Export your statement as PDF/text from online banking</li>
              </ul>
            </div>
          </div>
        ) : (
          <div style={{ padding: '16px', backgroundColor: '#fee', borderRadius: '8px', marginBottom: '16px' }}>
            <h3 style={{ color: '#c33', marginBottom: '8px' }}>⚠️ {error?.title}</h3>
            {error?.details && error.details.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                {error.details.map((detail, i) => (
                  <p key={i} style={{ fontSize: '12px', color: '#666', margin: '4px 0' }}>
                    • {detail}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {!isScanned && error?.duplicateCount > 0 && (
          <div style={{ padding: '12px', backgroundColor: '#fef3cd', borderRadius: '8px', marginBottom: '16px' }}>
            <h4 style={{ marginBottom: '8px', color: '#856404' }}>
              ⚠️ {error.duplicateCount} Duplicate Transaction{error.duplicateCount > 1 ? 's' : ''}
            </h4>
            {error.duplicates && error.duplicates.length > 0 && (
              <div style={{ fontSize: '12px' }}>
                {error.duplicates.map((dup, i) => (
                  <p key={i} style={{ margin: '4px 0', color: '#856404' }}>
                    • {new Date(dup.date).toLocaleDateString()} - ₹{dup.amount.toFixed(2)} - {dup.description.substring(0, 40)}...
                  </p>
                ))}
                {error.duplicateCount > 5 && (
                  <p style={{ margin: '8px 0', color: '#856404', fontStyle: 'italic' }}>
                    ... and {error.duplicateCount - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {!isScanned && error?.suggestions && error.suggestions.length > 0 && (
          <div style={{ padding: '12px', backgroundColor: '#d1ecf1', borderRadius: '8px', marginBottom: '16px' }}>
            <h4 style={{ marginBottom: '8px', color: '#0c5460' }}>💡 Suggestions</h4>
            {error.suggestions.map((suggestion, i) => (
              <p key={i} style={{ fontSize: '12px', color: '#0c5460', margin: '4px 0' }}>
                • {suggestion}
              </p>
            ))}
          </div>
        )}

        {!isScanned && error?.textPreview && (
          <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '16px' }}>
            <h4 style={{ marginBottom: '8px', color: '#495057' }}>📄 Extracted Text Preview</h4>
            <p style={{ fontSize: '10px', color: '#6c757d', marginBottom: '8px' }}>
              Bank Detected: {error.bankDetected || 'Unknown'}
            </p>
            <pre style={{
              fontSize: '10px',
              color: '#495057',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '150px',
              overflow: 'auto',
              backgroundColor: '#e9ecef',
              padding: '8px',
              borderRadius: '4px',
              margin: 0
            }}>
              {error.textPreview}
            </pre>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setStep('upload');
              setFile(null);
              setError(null);
            }}
          >
            Try Again
          </button>
          <button
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  const renderSuccessStep = () => (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
      <h2 style={{ marginBottom: '8px', color: 'var(--success-color)' }}>Import Successful!</h2>

      {previewData && (
        <div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', marginTop: '20px', textAlign: 'left' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Imported</p>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--success-color)' }}>
                {previewData.imported}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Skipped</p>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: previewData.skipped > 0 ? '#ff9800' : 'var(--text-secondary)' }}>
                {previewData.skipped}
              </p>
            </div>
          </div>

          {previewData.statementFormat && (
            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Bank Detected</p>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  {previewData.statementFormat.bank || 'Unknown Bank'}
                </p>
              </div>
              {previewData.parser && (
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Engine</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{previewData.parser}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p style={{ marginTop: '20px', color: 'var(--text-secondary)', fontSize: '12px' }}>
        Your transactions have been processed and added to your account.<br />
        Page will refresh automatically...
      </p>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3 className="modal-title">
            {step === 'upload' && '📄 Import Bank Statement PDF'}
            {step === 'error' && '❌ Import Error'}
            {step === 'success' && '✅ Success'}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {step === 'upload' && renderUploadStep()}
          {step === 'error' && renderErrorStep()}
          {step === 'success' && renderSuccessStep()}
        </div>
      </div>
    </div>
  );
};

export default PdfImportModal;
