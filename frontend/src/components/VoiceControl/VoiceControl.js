import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Spinner, Alert, Card } from 'react-bootstrap';
import { FaMicrophone, FaMicrophoneSlash, FaVolumeUp, FaStop, FaCheck, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import axios from 'axios';
import voiceRecognitionService from '../../services/voiceRecognitionService';
import naturalLanguageParser from '../../services/naturalLanguageParser';
import textToSpeechService from '../../services/textToSpeechService';
import './VoiceControl.css';

const VoiceControl = ({ show, onHide, user }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Setup voice recognition callbacks
    voiceRecognitionService.onResult(handleRecognitionResult);
    voiceRecognitionService.onError(handleRecognitionError);
    voiceRecognitionService.onEnd(handleRecognitionEnd);

    return () => {
      voiceRecognitionService.stop();
      textToSpeechService.stop();
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRecognitionResult = useCallback((result) => {
    if (result.isFinal) {
      setTranscript(result.transcript);
      setInterimTranscript('');
      processCommand(result.transcript);
    } else {
      setInterimTranscript(result.transcript);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRecognitionError = useCallback((error) => {
    setIsListening(false);
    setIsProcessing(false);

    // Don't show error for no-speech (user just didn't say anything)
    if (error.error === 'no-speech') {
      return;
    }

    setError(error.message);
    textToSpeechService.errorRecognitionFailed();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRecognitionEnd = useCallback(() => {
    setIsListening(false);
    setIsProcessing(false);
  }, []);

  const processCommand = useCallback(async (text) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Parse the voice command
      const parsed = naturalLanguageParser.parse(text);

      if (parsed.type === 'transaction') {
        if (!parsed.success) {
          // Missing required information
          setResult({
            success: false,
            message: parsed.error,
            missing: parsed.missing
          });
          textToSpeechService.errorMissingAmount();
        } else {
          // Try to save the transaction
          const transactionData = parsed.data;
          transactionData.user = user._id;

          const response = await axios.post('/api/transactions', transactionData);

          if (response.data.success) {
            setResult({
              success: true,
              message: 'Transaction added successfully',
              transaction: response.data.data
            });
            textToSpeechService.confirmTransactionAdded(response.data.data);
          }
        }
      } else if (parsed.type === 'query') {
        // Handle query
        await handleQuery(parsed.query);
      }
    } catch (err) {
      console.error('Error processing command:', err);
      setError(err.response?.data?.message || err.message || 'Failed to process command');
      textToSpeechService.errorRecognitionFailed();
    } finally {
      setIsProcessing(false);
    }
  }, [user]);

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

        // Find expense total
        const expenseSummary = summary.find(s => s._id === 'expense') || { total: 0, count: 0 };
        const total = expenseSummary.total;

        // If searching for specific category
        let finalTotal = total;
        let finalCount = expenseSummary.count;
        let filteredBreakdown = categoryBreakdown;

        if (query.category) {
          const catData = categoryBreakdown.find(c => c._id === query.category);
          finalTotal = catData ? catData.total : 0;
          finalCount = catData ? catData.count : 0;
          filteredBreakdown = catData ? [catData] : [];
        }

        const queryResult = {
          type: query.type,
          timePeriod: query.timePeriod,
          category: query.category,
          total: finalTotal,
          transactionCount: finalCount,
          categoryBreakdown: categoryBreakdown.map(c => ({ category: c._id, total: c.total }))
        };

        setResult({
          success: true,
          message: 'Query results',
          queryResult
        });

        textToSpeechService.speakQueryResult(queryResult);
      }
    } catch (err) {
      console.error('Error handling query:', err);
      setError('Failed to fetch query results');
    }
  };

  const startListening = () => {
    setError(null);
    setResult(null);
    setTranscript('');
    setInterimTranscript('');

    const started = voiceRecognitionService.start();
    if (started) {
      setIsListening(true);
      textToSpeechService.speakListening();
    } else {
      setError('Failed to start voice recognition. Please check microphone permissions.');
    }
  };

  const stopListening = () => {
    voiceRecognitionService.stop();
    setIsListening(false);
  };

  const speakResult = () => {
    setIsSpeaking(true);
    if (result?.success && result?.transaction) {
      textToSpeechService.confirmTransactionAdded(result.transaction);
    } else if (result?.queryResult) {
      textToSpeechService.speakQueryResult(result.queryResult);
    }
    // Reset after a delay
    setTimeout(() => setIsSpeaking(false), 3000);
  };

  const closeModal = () => {
    voiceRecognitionService.stop();
    textToSpeechService.stop();
    onHide();
  };

  return (
    <Modal show={show} onHide={closeModal} centered size="lg" className="voice-control-modal">
      <Modal.Header closeButton>
        <Modal.Title>
          <FaMicrophone className="me-2" />
          Voice Control
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Voice Visualization */}
        <div className="voice-visualization">
          <div className={`microphone-button ${isListening ? 'listening' : ''}`}>
            {isListening ? (
              <FaMicrophone size={40} />
            ) : (
              <FaMicrophoneSlash size={40} />
            )}
          </div>
          {isListening && (
            <div className="sound-wave">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
          )}
        </div>

        {/* Status Message */}
        <div className="voice-status">
          {isProcessing ? (
            <div className="processing">
              <Spinner animation="border" size="sm" className="me-2" />
              Processing...
            </div>
          ) : isListening ? (
            <span className="listening-text">Listening...</span>
          ) : (
            <span className="ready-text">Tap the microphone to start</span>
          )}
        </div>

        {/* Transcript Display */}
        {(transcript || interimTranscript) && (
          <div className="transcript-container">
            <div className="transcript">
              <strong>You said:</strong>
              <p>{transcript || interimTranscript}</p>
              {interimTranscript && <span className="interim">{interimTranscript}</span>}
            </div>
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className={`result-container ${result.success ? 'success' : 'error'}`}>
            {result.success ? (
              <div className="result-success">
                <FaCheck className="result-icon" />
                <div>
                  <strong>Transaction Added!</strong>
                  {result.transaction && (
                    <p>
                      ₹{result.transaction.amount} - {result.transaction.category}
                      <br />
                      <small>{result.transaction.description}</small>
                    </p>
                  )}
                  {result.queryResult && (
                    <p>
                      Total: ₹{result.queryResult.total} ({result.queryResult.transactionCount} transactions)
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="result-error">
                <FaExclamationTriangle className="result-icon" />
                <div>
                  <strong>Could not process</strong>
                  <p>{result.message}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="danger" className="mt-3">
            <FaTimes className="me-2" />
            {error}
          </Alert>
        )}

        {/* Example Commands */}
        <Card className="example-commands mt-3">
          <Card.Header>Example Voice Commands</Card.Header>
          <Card.Body>
            <ul>
              <li>"I spent 500 rupees on groceries"</li>
              <li>"Add 200 rupees for transportation"</li>
              <li>"Paid 50 rupees for coffee"</li>
              <li>"What's my spending this month?"</li>
              <li>"Show my food expenses"</li>
            </ul>
          </Card.Body>
        </Card>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={closeModal}>
          Close
        </Button>

        {result && (
          <Button variant="info" onClick={speakResult} disabled={isSpeaking}>
            <FaVolumeUp className="me-2" />
            Read Aloud
          </Button>
        )}

        {isListening ? (
          <Button variant="danger" onClick={stopListening}>
            <FaStop className="me-2" />
            Stop
          </Button>
        ) : (
          <Button
            variant={isListening ? 'danger' : 'primary'}
            onClick={startListening}
            disabled={isProcessing}
          >
            <FaMicrophone className="me-2" />
            {isProcessing ? 'Processing...' : 'Start Listening'}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default VoiceControl;
