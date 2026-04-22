/**
 * Logistic Regression Classifier for Multi-Class Categorization
 * Uses Stochastic Gradient Descent to learn from transaction history
 */
class LogisticClassifier {
  constructor(categories) {
    this.categories = categories;
    this.weights = {}; // Feature weights per category
    this.learningRate = 0.1;
  }

  // Feature Extraction: Simple Bag-of-Words
  getFeatures(text) {
    const features = {};
    const words = text.toLowerCase().match(/\w+/g) || [];
    words.forEach(word => {
      features[word] = 1;
    });
    return features;
  }

  sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
  }

  softmax(scores) {
    const maxScore = Math.max(...Object.values(scores));
    const exps = {};
    let sum = 0;
    
    for (const cat of this.categories) {
      exps[cat] = Math.exp((scores[cat] || 0) - maxScore);
      sum += exps[cat];
    }
    
    const probs = {};
    for (const cat of this.categories) {
      probs[cat] = exps[cat] / sum;
    }
    return probs;
  }

  predict(text) {
    const features = this.getFeatures(text);
    const scores = {};
    
    for (const cat of this.categories) {
      let score = 0;
      const catWeights = this.weights[cat] || {};
      for (const feature in features) {
        score += catWeights[feature] || 0;
      }
      scores[cat] = score;
    }
    
    return this.softmax(scores);
  }

  train(data, iterations = 100) {
    // data: [{ text: "...", category: "..." }]
    this.categories.forEach(cat => { if (!this.weights[cat]) this.weights[cat] = {}; });

    for (let i = 0; i < iterations; i++) {
      for (const item of data) {
        const probs = this.predict(item.text);
        const features = this.getFeatures(item.text);

        for (const cat of this.categories) {
          const target = item.category === cat ? 1 : 0;
          const error = target - probs[cat];
          
          for (const feature in features) {
            this.weights[cat][feature] = (this.weights[cat][feature] || 0) + this.learningRate * error;
          }
        }
      }
    }
  }
}

/**
 * Service to train and use the classifier based on User data
 */
async function getSmartCategorizer(userId, Transaction) {
  const transactions = await Transaction.find({ user: userId }).limit(500);
  const categories = [...new Set(transactions.map(t => t.category))];
  
  if (categories.length < 2) return null;

  const classifier = new LogisticClassifier(categories);
  const trainingData = transactions.map(t => ({
    text: t.description,
    category: t.category
  }));

  classifier.train(trainingData);
  return classifier;
}

module.exports = { LogisticClassifier, getSmartCategorizer };
