/**
 * Voice Recognition Service
 * Handles speech-to-text using Web Speech API
 */

class VoiceRecognitionService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isSupported = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onEndCallback = null;

    this.init();
  }

  init() {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 3;
      this.isSupported = true;

      this.setupEventHandlers();
    } else {
      console.warn('Speech recognition is not supported in this browser');
      this.isSupported = false;
    }
  }

  setupEventHandlers() {
    this.recognition.onresult = (event) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      
      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript;
        const confidence = lastResult[0].confidence;
        
        if (this.onResultCallback) {
          this.onResultCallback({
            transcript,
            confidence,
            isFinal: true
          });
        }
      } else {
        // Interim result
        const transcript = lastResult[0].transcript;
        if (this.onResultCallback) {
          this.onResultCallback({
            transcript,
            confidence: 0,
            isFinal: false
          });
        }
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      const errorMessages = {
        'no-speech': 'No speech detected. Please try again.',
        'audio-capture': 'No microphone found. Please check your microphone settings.',
        'not-allowed': 'Microphone access denied. Please allow microphone access.',
        'network': 'Network error. Please check your internet connection.',
        'aborted': 'Speech recognition was cancelled.',
        'language-not-supported': 'The selected language is not supported.'
      };

      const errorMessage = errorMessages[event.error] || `Error: ${event.error}`;

      if (this.onErrorCallback) {
        this.onErrorCallback({
          error: event.error,
          message: errorMessage
        });
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onEndCallback) {
        this.onEndCallback();
      }
    };

    this.recognition.onstart = () => {
      this.isListening = true;
    };
  }

  /**
   * Start listening for speech
   */
  start() {
    if (!this.isSupported) {
      if (this.onErrorCallback) {
        this.onErrorCallback({
          error: 'not-supported',
          message: 'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.'
        });
      }
      return false;
    }

    if (this.isListening) {
      this.stop();
    }

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Error starting recognition:', error);
      return false;
    }
  }

  /**
   * Stop listening for speech
   */
  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      return true;
    }
    return false;
  }

  /**
   * Set callback for results
   */
  onResult(callback) {
    this.onResultCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback) {
    this.onErrorCallback = callback;
  }

  /**
   * Set callback for end event
   */
  onEnd(callback) {
    this.onEndCallback = callback;
  }

  /**
   * Set the language for recognition
   */
  setLanguage(lang) {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  /**
   * Check if currently supported
   */
  checkSupport() {
    return this.isSupported;
  }
}

// Export singleton instance
const voiceRecognitionService = new VoiceRecognitionService();
export default voiceRecognitionService;
