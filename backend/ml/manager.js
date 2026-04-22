const AIModel = require('../models/AIModel');
const Transaction = require('../models/Transaction');
const { TFIDF, AdvancedClassifier, calculateRiskProbability } = require('./engine');

class ModelManager {
  static async getModelForUser(userId) {
    let modelRecord = await AIModel.findOne({ user: userId });
    
    if (!modelRecord) {
      // Initialize new model
      modelRecord = await AIModel.create({
        user: userId,
        weights: {},
        vocabulary: [],
        idf: {}
      });
    }

    const vectoriser = new TFIDF(modelRecord.vocabulary, Object.fromEntries(modelRecord.idf || []));
    const classifier = new AdvancedClassifier(
      ['Food & Dining', 'Shopping', 'Transport', 'Healthcare', 'Utilities', 'Entertainment', 'Salary', 'Other'],
      Object.fromEntries(modelRecord.weights || [])
    );

    return { vectoriser, classifier, modelRecord };
  }

  static async predictTransaction(userId, description) {
    const { vectoriser, classifier } = await this.getModelForUser(userId);
    
    // If model is empty (not yet trained), returned null to trigger fallback
    if (vectoriser.vocabulary.length === 0) return null;

    const vector = vectoriser.transform(description);
    const probs = classifier.predict(vector);
    
    // Find highest probability
    const sorted = Object.entries(probs).sort((a, b) => b[1] - a[1]);
    const [category, confidence] = sorted[0];

    return {
      predicted_category: category,
      confidence: Math.round(confidence * 100) / 100,
      probabilities: probs
    };
  }

  static async trainModel(userId) {
    const transactions = await Transaction.find({ user: userId }).limit(1000);
    if (transactions.length < 10) return { success: false, reason: 'insufficient_data' };

    const trainingData = transactions.map(t => ({
      text: t.description,
      category: t.category
    }));

    const vectoriser = new TFIDF();
    vectoriser.fit(trainingData.map(d => d.text));

    const processedData = trainingData.map(d => ({
      vector: vectoriser.transform(d.text),
      category: d.category
    }));

    const categories = ['Food & Dining', 'Shopping', 'Transport', 'Healthcare', 'Utilities', 'Entertainment', 'Salary', 'Other'];
    const classifier = new AdvancedClassifier(categories);
    classifier.train(processedData, 100);

    // Persist to DB
    await AIModel.findOneAndUpdate(
      { user: userId },
      {
        weights: classifier.weights,
        vocabulary: vectoriser.vocabulary,
        idf: vectoriser.idf,
        lastTrained: new Date(),
        performance: { sampleSize: transactions.length }
      },
      { upsert: true }
    );

    return { success: true, samples: transactions.length };
  }

  static async getBudgetRisk(userId, category, currentSpend, budget, daysPassed, totalDays) {
    const riskProb = calculateRiskProbability({
      current_spend: currentSpend,
      budget: budget,
      days_passed: daysPassed,
      total_days: totalDays
    });

    let insight = "Your spending is on track.";
    if (riskProb > 0.8) insight = "CRITICAL: Highly likely to exceed budget. Reduce spending immediately.";
    else if (riskProb > 0.5) insight = "WARNING: Moderate risk of exceeding budget. Monitor your transactions.";

    return {
      risk_probability: Math.round(riskProb * 100),
      insight_message: insight
    };
  }
}

module.exports = ModelManager;
