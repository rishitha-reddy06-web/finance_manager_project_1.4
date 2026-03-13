/**
 * Text-to-Speech Service
 * Provides audio feedback using Web Speech API
 */

class TextToSpeechService {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voice = null;
    this.isSupported = false;
    this.isSpeaking = false;
    this.voices = [];

    this.init();
  }

  init() {
    if (this.synth) {
      this.isSupported = true;

      // Load voices (may be async)
      this.loadVoices();

      // Some browsers load voices asynchronously
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    } else {
      console.warn('Text-to-speech is not supported in this browser');
      this.isSupported = false;
    }
  }

  loadVoices() {
    this.voices = this.synth.getVoices();

    // Try to find an English voice
    this.voice = this.voices.find(v => v.lang.startsWith('en-')) || this.voices[0];
  }

  /**
   * Speak the given text
   * @param {string} text - Text to speak
   * @param {object} options - Speech options
   */
  speak(text, options = {}) {
    if (!this.isSupported) {
      console.warn('Text-to-speech not supported');
      return false;
    }

    // Cancel any ongoing speech
    if (this.isSpeaking) {
      this.synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // Set voice
    if (this.voice) {
      utterance.voice = this.voice;
    }

    // Set options
    utterance.rate = options.rate || 1; // 0.1 to 10
    utterance.pitch = options.pitch || 1; // 0 to 2
    utterance.volume = options.volume || 1; // 0 to 1

    // Event handlers
    utterance.onstart = () => {
      this.isSpeaking = true;
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (options.onEnd) options.onEnd();
    };

    utterance.onerror = (event) => {
      this.isSpeaking = false;
      console.error('TTS error:', event.error);
      if (options.onError) options.onError(event);
    };

    this.synth.speak(utterance);
    return true;
  }

  /**
   * Stop speaking
   */
  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
      return true;
    }
    return false;
  }

  /**
   * Check if currently speaking
   */
  isSpeakingNow() {
    return this.isSpeaking;
  }

  /**
   * Check support
   */
  checkSupport() {
    return this.isSupported;
  }

  // ==================== Transaction Confirmation Messages ====================

  /**
   * Confirm transaction was added
   */
  confirmTransactionAdded(transaction) {
    const amount = transaction.amount;
    const category = transaction.category;
    const description = transaction.description;

    const message = `Transaction added successfully. ${amount} rupees for ${category}. ${description !== 'Voice entry' ? description : ''}`;
    this.speak(message);
  }

  /**
   * Ask for confirmation of a transaction
   */
  askForConfirmation(transaction) {
    const amount = transaction.amount;
    const category = transaction.category;
    const message = `I found a transaction of ${amount} rupees for ${category}. Should I add this? Say yes to confirm or no to cancel.`;
    this.speak(message);
  }

  /**
   * Error message for missing amount
   */
  errorMissingAmount() {
    const message = "I couldn't understand the amount. Please say something like 'I spent 500 rupees on food' or 'add 100 rupees for transportation'.";
    this.speak(message);
  }

  /**
   * Error message for recognition failure
   */
  errorRecognitionFailed() {
    const message = "I didn't catch that. Could you please repeat what you'd like to add?";
    this.speak(message);
  }

  /**
   * Ask for clarification
   */
  askForClarification(missing) {
    let message = "I need some more details.";
    if (missing && missing.includes('amount')) {
      message = "I caught the category but missed the amount. Could you please repeat the amount?";
    } else {
      message = "I couldn't quite get that. Could you please repeat the amount and what it's for?";
    }
    this.speak(message);
  }

  /**
   * Confirmation for query response
   */
  speakQueryResult(data) {
    let message = '';

    if (data.type === 'summary') {
      if (data.total !== undefined) {
        message = `Your total spending ${data.timePeriod} is ${Math.round(data.total)} rupees.`;

        if (data.categoryBreakdown && data.categoryBreakdown.length > 0) {
          message += ' Here are the top categories: ';
          const topCategories = data.categoryBreakdown.slice(0, 3);
          const categoryList = topCategories.map(c =>
            `${c.category}: ${Math.round(c.total)} rupees`
          ).join(', ');
          message += categoryList;
        }
      } else {
        message = `You don't have any transactions ${data.timePeriod}.`;
      }
    } else if (data.type === 'category') {
      if (data.category && data.total !== undefined) {
        message = `You spent ${Math.round(data.total)} rupees on ${data.category} ${data.timePeriod}.`;
      } else {
        message = "I couldn't find spending information for that category.";
      }
    }

    this.speak(message);
  }

  /**
   * Speak transaction list
   */
  speakTransactionsList(transactions) {
    if (!transactions || transactions.length === 0) {
      this.speak("You don't have any recent transactions.");
      return;
    }

    let message = `You have ${transactions.length} recent transactions. `;

    const recentTx = transactions.slice(0, 5);
    const txList = recentTx.map((tx, index) => {
      const date = new Date(tx.date).toLocaleDateString();
      return `${index + 1}. ${tx.amount} rupees for ${tx.category} on ${date}`;
    }).join('. ');

    message += txList;

    if (transactions.length > 5) {
      message += `. And ${transactions.length - 5} more transactions.`;
    }

    this.speak(message);
  }

  /**
   * Greeting message
   */
  speakGreeting() {
    const greetings = [
      "Hello! How can I help you today? You can say things like 'I spent 500 rupees on groceries' to add a transaction.",
      "Hi! I'm ready to help you track your expenses. Just tell me what you spent and how much.",
      "Welcome! Say something like 'add 200 rupees for transport' to record a transaction."
    ];

    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    this.speak(randomGreeting);
  }

  /**
   * Listening confirmation
   */
  speakListening() {
    const messages = [
      "I'm listening...",
      "Go ahead, I'm recording.",
      "Yes, tell me more."
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    this.speak(randomMessage);
  }
}

// Export singleton instance
const textToSpeechService = new TextToSpeechService();
export default textToSpeechService;
