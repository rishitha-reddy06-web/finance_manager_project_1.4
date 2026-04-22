/**
 * Advanced ML Engine for Personal Finance
 * Implements TF-IDF Vectorization and Logistic Regression for Risk & Categories
 */

class MLUtils {
  static tokenize(text) {
    return text.toLowerCase().match(/\b(\w+)\b/g) || [];
  }

  static sigmoid(z) {
    return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, z))));
  }
}

class TFIDF {
  constructor(vocabulary = [], idf = {}) {
    this.vocabulary = vocabulary;
    this.idf = idf;
  }

  fit(documents) {
    const docTokens = documents.map(doc => new Set(MLUtils.tokenize(doc)));
    const totalDocs = documents.length;
    
    // Create vocabulary
    const vocabSet = new Set();
    docTokens.forEach(tokens => tokens.forEach(t => vocabSet.add(t)));
    this.vocabulary = Array.from(vocabSet);

    // Calculate IDF
    this.idf = {};
    this.vocabulary.forEach(term => {
      const docCount = docTokens.filter(tokens => tokens.has(term)).length;
      this.idf[term] = Math.log(totalDocs / (1 + docCount));
    });
  }

  transform(text) {
    const tokens = MLUtils.tokenize(text);
    const tf = {};
    tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
    
    const vector = {};
    this.vocabulary.forEach(term => {
      if (tf[term]) {
        vector[term] = (tf[term] / tokens.length) * (this.idf[term] || 0);
      }
    });
    return vector;
  }
}

class AdvancedClassifier {
  constructor(categories, weights = {}) {
    this.categories = categories;
    this.weights = weights; // { cat: { term: weight } }
  }

  predict(vector) {
    const scores = {};
    this.categories.forEach(cat => {
      let score = 0;
      const catWeights = this.weights[cat] || {};
      for (const term in vector) {
        score += vector[term] * (catWeights[term] || 0);
      }
      scores[cat] = score;
    });

    // Softmax for multi-class probability
    const exps = {};
    let sum = 0;
    this.categories.forEach(cat => {
      exps[cat] = Math.exp(Math.min(10, scores[cat]));
      sum += exps[cat];
    });

    const probs = {};
    this.categories.forEach(cat => {
      probs[cat] = exps[cat] / sum;
    });
    return probs;
  }

  train(trainingData, iterations = 50) {
    const learningRate = 0.5;
    for (let i = 0; i < iterations; i++) {
      trainingData.forEach(({ vector, category }) => {
        const probs = this.predict(vector);
        this.categories.forEach(cat => {
          const target = category === cat ? 1 : 0;
          const error = target - probs[cat];
          for (const term in vector) {
            if (!this.weights[cat]) this.weights[cat] = {};
            this.weights[cat][term] = (this.weights[cat][term] || 0) + learningRate * error * vector[term];
          }
        });
      });
    }
  }
}

/**
 * Budget Risk Model using Logistic Regression
 * Predicts probability of exceeding budget based on current velocity
 */
function calculateRiskProbability(features) {
  const { current_spend, budget, days_passed, total_days } = features;
  if (!budget || budget <= 0) return 0;

  const remaining_days = total_days - days_passed;
  const velocity = current_spend / days_passed;
  const budget_per_day = budget / total_days;
  
  // Feature Engineering for Logistic Model
  // x1: Spending ratio vs Time ratio
  const ratio = (current_spend / budget) / (days_passed / total_days);
  // x2: Projected total vs budget
  const projection = velocity * total_days;
  const overshot_pct = (projection - budget) / budget;

  // Logistic Weights (Pre-calibrated for finance)
  const z = -2 + (3 * ratio) + (5 * overshot_pct);
  return MLUtils.sigmoid(z);
}

module.exports = { TFIDF, AdvancedClassifier, calculateRiskProbability };
