import React, { useState, useEffect, useCallback } from 'react';
import { FaMicrophone, FaMicrophoneSlash, FaVolumeUp, FaStop, FaTimes, FaCompress } from 'react-icons/fa';
import axios from 'axios';
import voiceRecognitionService from '../../services/voiceRecognitionService';
import naturalLanguageParser from '../../services/naturalLanguageParser';
import textToSpeechService from '../../services/textToSpeechService';
import './VoiceControlPanel.css';

const VoiceControlPanel = ({ user, onTransactionAdded }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const [pendingTransaction, setPendingTransaction] = useState(null);

  const saveTransaction = async (data) => {
    setIsProcessing(true);
    try {
      const response = await axios.post('/api/transactions', data);
      if (response.data.success) {
        setResult({ success: true, message: 'Transaction added', transaction: response.data.data });
        textToSpeechService.confirmTransactionAdded(response.data.data);
        if (onTransactionAdded) onTransactionAdded();
        setPendingTransaction(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save');
      textToSpeechService.errorRecognitionFailed();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuery = async (query) => {
    try {
      const now = new Date();
      let year = now.getFullYear();
      let month = now.getMonth() + 1;

      if (query.timePeriod === 'last month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        year = lastMonth.getFullYear();
        month = lastMonth.getMonth() + 1;
      }

      const response = await axios.get(`/api/transactions/summary/monthly?year=${year}&month=${month}`);

      if (response.data.success) {
        const { summary, categoryBreakdown } = response.data.data;
        const expenseSummary = summary.find(s => s._id === 'expense') || { total: 0, count: 0 };

        let finalTotal = expenseSummary.total;
        let finalCount = expenseSummary.count;

        if (query.category) {
          const catData = categoryBreakdown.find(c => c._id === query.category);
          finalTotal = catData ? catData.total : 0;
          finalCount = catData ? catData.count : 0;
        }

        const queryResult = {
          type: query.type,
          timePeriod: query.timePeriod,
          category: query.category,
          total: finalTotal,
          transactionCount: finalCount,
          categoryBreakdown: categoryBreakdown.map(c => ({ category: c._id, total: c.total }))
        };

        setResult({ success: true, message: 'Query results', queryResult });
        textToSpeechService.speakQueryResult(queryResult);
      }
    } catch (err) {
      setError('Failed to fetch query results');
    }
  };

  const processCommand = useCallback(async (text) => {
    setIsProcessing(true);
    setError(null);

    try {
      const parsed = naturalLanguageParser.parse(text);

      // Handle response to a confirmation prompt
      if (pendingTransaction) {
        if (parsed.type === 'confirm') {
          await saveTransaction(pendingTransaction);
          return;
        } else if (parsed.type === 'cancel') {
          setPendingTransaction(null);
          setResult({ success: false, message: 'Cancelled' });
          textToSpeechService.speak('Cancelled');
          return;
        }
      }

      if (parsed.type === 'transaction') {
        if (!parsed.success) {
          setResult({ success: false, message: parsed.error, missing: parsed.missing });
          textToSpeechService.errorMissingAmount();
        } else {
          const transactionData = { ...parsed.data, user: user._id };
          setPendingTransaction(transactionData);
          setResult({
            success: true,
            message: 'Awaiting confirmation...',
            transaction: transactionData,
            isPending: true
          });
          setIsProcessing(false); // Stop processing UI before asking
          textToSpeechService.askForConfirmation(transactionData, () => {
            startListening(true); // Auto-start listening for yes/no
          });
        }
      } else if (parsed.type === 'query') {
        await handleQuery(parsed.query);
      }
    } catch (err) {
      console.error('Error processing command:', err);
      setError(err.response?.data?.message || err.message || 'Failed to process');
      textToSpeechService.errorRecognitionFailed();
    } finally {
      setIsProcessing(false);
    }
  }, [user, onTransactionAdded, pendingTransaction]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRecognitionResult = useCallback((result) => {
    if (result.isFinal) {
      setTranscript(result.transcript);
      setInterimTranscript('');
      processCommand(result.transcript);
    } else {
      setInterimTranscript(result.transcript);
    }
  }, [processCommand]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRecognitionError = useCallback((error) => {
    setIsListening(false);
    setIsProcessing(false);
    if (error.error === 'no-speech') return;
    setError(error.message);
    textToSpeechService.errorRecognitionFailed();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRecognitionEnd = useCallback(() => {
    setIsListening(false);
    setIsProcessing(false);
  }, []);

  useEffect(() => {
    voiceRecognitionService.onResult(handleRecognitionResult);
    voiceRecognitionService.onError(handleRecognitionError);
    voiceRecognitionService.onEnd(handleRecognitionEnd);

    return () => {
      voiceRecognitionService.stop();
    };
  }, [handleRecognitionResult, handleRecognitionError, handleRecognitionEnd]);

  const startListening = (keepResult = false) => {
    setError(null);
    if (!keepResult) {
      setResult(null);
      setTranscript('');
    }
    setInterimTranscript('');
    const started = voiceRecognitionService.start();
    if (started) setIsListening(true);
    else setError('Failed to start. Check microphone permissions.');
  };

  const stopListening = () => {
    voiceRecognitionService.stop();
    setIsListening(false);
  };

  const handleCancel = () => {
    voiceRecognitionService.stop();
    setIsListening(false);
    setIsProcessing(false);
    setTranscript('');
    setInterimTranscript('');
    setResult(null);
    setError(null);
    setPendingTransaction(null);
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <div className={`voice-control-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="voice-panel-header" onClick={toggleExpand}>
        <div className="voice-panel-title">
          <FaMicrophone className="me-2" />
          Voice Control
          <span className="voice-panel-subtitle">Add transactions by voice</span>
        </div>
        <button className="voice-panel-toggle" type="button">
          <FaCompress />
        </button>
      </div>

      {isExpanded && (
        <div className="voice-panel-body">
          {/* Microphone Button */}
          <div className="voice-mic-section">
            <button
              className={`voice-mic-btn ${isListening ? 'listening' : ''} ${isProcessing ? 'processing' : ''}`}
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing}
            >
              {isListening ? <FaMicrophone size={24} /> : isProcessing ? <span className="spinner"></span> : <FaMicrophoneSlash size={24} />}
            </button>
            <div className="voice-status-text">
              {isProcessing ? 'Processing...' : isListening ? 'Listening...' : 'Tap to speak'}
            </div>
          </div>

          {/* Sound Wave Animation */}
          {isListening && (
            <div className="voice-sound-wave">
              {[...Array(5)].map((_, i) => <span key={i}></span>)}
            </div>
          )}

          {/* Transcript */}
          {(transcript || interimTranscript) && (
            <div className="voice-transcript">
              <span className="transcript-label">You said:</span>
              <span className="transcript-text">{transcript || interimTranscript}</span>
              {interimTranscript && <span className="transcript-interim">{interimTranscript}</span>}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`voice-result ${result.success ? 'success' : 'error'} ${result.isPending ? 'pending' : ''}`}>
              {result.success ? (
                <>
                  <span className="result-icon">{result.isPending ? '?' : '✓'}</span>
                  <div className="result-content">
                    <span className="result-text">
                      {result.transaction ? `₹${result.transaction.amount} - ${result.transaction.category}` :
                        result.queryResult ? `Total: ₹${result.queryResult.total}` : result.message}
                    </span>
                    {result.isPending && (
                      <div className="voice-confirm-actions mt-2">
                        <button className="btn btn-success btn-sm me-2" onClick={() => saveTransaction(pendingTransaction)}>
                          Confirm
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={handleCancel}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span className="result-icon">!</span>
                  <span className="result-text">{result.message}</span>
                </>
              )}
            </div>
          )}

          {/* Error */}
          {error && <div className="voice-error">{error}</div>}

          {/* Example Commands */}
          <div className="voice-examples">
            <span className="examples-label">Try:</span>
            <span className="example-text">"500 rupees groceries"</span>
            <span className="example-text">"200 transport"</span>
          </div>

        </div>
      )}
    </div>
  );
};

export default VoiceControlPanel;
