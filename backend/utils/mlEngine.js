/**
 * ML Prediction Engine v2
 * - Random Forest Regression (ensemble of decision trees)
 * - Linear Regression (fallback)
 * - Model persistence to MongoDB
 * - Auto-train on first request, use cached model afterwards
 */

const TrainedModel = require('../models/TrainedModel');
const Budget = require('../models/Budget');

// ═══════════════════════════════════════════════
// LINEAR REGRESSION (used as base learner + fallback)
// ═══════════════════════════════════════════════
class LinearRegression {
  constructor() { this.slope = 0; this.intercept = 0; this.r2 = 0; }

  train(X, y) {
    const n = X.length;
    if (n < 2) return;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += X[i]; sumY += y[i]; sumXY += X[i] * y[i]; sumXX += X[i] * X[i];
    }
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return;
    this.slope = (n * sumXY - sumX * sumY) / denom;
    this.intercept = (sumY - this.slope * sumX) / n;
    const yMean = sumY / n;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < n; i++) {
      const pred = this.slope * X[i] + this.intercept;
      ssTot += (y[i] - yMean) ** 2;
      ssRes += (y[i] - pred) ** 2;
    }
    this.r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
  }

  predict(x) { return this.slope * x + this.intercept; }

  toJSON() { return { slope: this.slope, intercept: this.intercept, r2: this.r2 }; }

  static fromJSON(obj) {
    const m = new LinearRegression();
    m.slope = obj.slope; m.intercept = obj.intercept; m.r2 = obj.r2;
    return m;
  }
}

// ═══════════════════════════════════════════════
// DECISION TREE (building block for Random Forest)
// ═══════════════════════════════════════════════
class DecisionTreeNode {
  constructor() {
    this.featureIndex = null;
    this.threshold = null;
    this.left = null;
    this.right = null;
    this.value = null; // leaf value (mean of targets)
  }
}

class DecisionTree {
  constructor(maxDepth = 5, minSamples = 2) {
    this.maxDepth = maxDepth;
    this.minSamples = minSamples;
    this.root = null;
  }

  train(X, y) {
    this.root = this._buildTree(X, y, 0);
  }

  _buildTree(X, y, depth) {
    const node = new DecisionTreeNode();
    if (depth >= this.maxDepth || y.length <= this.minSamples) {
      node.value = y.reduce((a, b) => a + b, 0) / y.length;
      return node;
    }

    let bestFeature = 0, bestThreshold = 0, bestMSE = Infinity;
    const numFeatures = X[0].length;

    for (let f = 0; f < numFeatures; f++) {
      const values = X.map(row => row[f]).sort((a, b) => a - b);
      const thresholds = [...new Set(values)];

      for (const t of thresholds) {
        const leftIdx = [], rightIdx = [];
        for (let i = 0; i < X.length; i++) {
          if (X[i][f] <= t) leftIdx.push(i); else rightIdx.push(i);
        }
        if (leftIdx.length === 0 || rightIdx.length === 0) continue;

        const leftY = leftIdx.map(i => y[i]);
        const rightY = rightIdx.map(i => y[i]);
        const mse = this._weightedMSE(leftY, rightY);

        if (mse < bestMSE) {
          bestMSE = mse;
          bestFeature = f;
          bestThreshold = t;
        }
      }
    }

    // If no good split found, make leaf
    if (bestMSE === Infinity) {
      node.value = y.reduce((a, b) => a + b, 0) / y.length;
      return node;
    }

    node.featureIndex = bestFeature;
    node.threshold = bestThreshold;

    const leftIdx = [], rightIdx = [];
    for (let i = 0; i < X.length; i++) {
      if (X[i][bestFeature] <= bestThreshold) leftIdx.push(i); else rightIdx.push(i);
    }

    node.left = this._buildTree(leftIdx.map(i => X[i]), leftIdx.map(i => y[i]), depth + 1);
    node.right = this._buildTree(rightIdx.map(i => X[i]), rightIdx.map(i => y[i]), depth + 1);
    return node;
  }

  _weightedMSE(left, right) {
    const mse = (arr) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
    };
    const n = left.length + right.length;
    return (left.length / n) * mse(left) + (right.length / n) * mse(right);
  }

  predict(features) {
    let node = this.root;
    while (node.value === null) {
      if (features[node.featureIndex] <= node.threshold) node = node.left;
      else node = node.right;
    }
    return node.value;
  }

  toJSON() { return JSON.parse(JSON.stringify(this.root)); }

  static fromJSON(obj) {
    const tree = new DecisionTree();
    tree.root = obj;
    return tree;
  }
}

// ═══════════════════════════════════════════════
// RANDOM FOREST REGRESSION
// ═══════════════════════════════════════════════
class RandomForest {
  constructor(nTrees = 10, maxDepth = 4, minSamples = 2) {
    this.nTrees = nTrees;
    this.maxDepth = maxDepth;
    this.minSamples = minSamples;
    this.trees = [];
    this.r2 = 0;
  }

  train(X, y) {
    this.trees = [];
    for (let t = 0; t < this.nTrees; t++) {
      // Bootstrap sample (random sampling with replacement)
      const sampleX = [], sampleY = [];
      for (let i = 0; i < X.length; i++) {
        const idx = Math.floor(Math.random() * X.length);
        sampleX.push(X[idx]);
        sampleY.push(y[idx]);
      }
      const tree = new DecisionTree(this.maxDepth, this.minSamples);
      tree.train(sampleX, sampleY);
      this.trees.push(tree);
    }

    // Calculate R² on training data
    const yMean = y.reduce((a, b) => a + b, 0) / y.length;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < X.length; i++) {
      const pred = this.predict(X[i]);
      ssTot += (y[i] - yMean) ** 2;
      ssRes += (y[i] - pred) ** 2;
    }
    this.r2 = ssTot === 0 ? 0 : Math.max(0, 1 - (ssRes / ssTot));
  }

  predict(features) {
    if (this.trees.length === 0) return 0;
    const preds = this.trees.map(t => t.predict(features));
    return preds.reduce((a, b) => a + b, 0) / preds.length;
  }

  toJSON() {
    return { trees: this.trees.map(t => t.toJSON()), r2: this.r2, nTrees: this.nTrees };
  }

  static fromJSON(obj) {
    const rf = new RandomForest(obj.nTrees);
    rf.r2 = obj.r2;
    rf.trees = obj.trees.map(t => DecisionTree.fromJSON(t));
    return rf;
  }
}

// ═══════════════════════════════════════════════
// FEATURE ENGINEERING
// ═══════════════════════════════════════════════
const engineerFeatures = (txs) => {
  if (txs.length === 0) return null;
  const months = {};

  txs.forEach(t => {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    if (!months[key]) months[key] = { total: 0, count: 0, weekends: 0, weekdays: 0 };
    months[key].total += t.amount;
    months[key].count += 1;
    const day = date.getDay();
    if (day === 0 || day === 6) months[key].weekends += t.amount;
    else months[key].weekdays += t.amount;
  });

  const sortedMonths = Object.keys(months).sort().map(key => months[key]);
  if (sortedMonths.length < 2) return null;

  const latest = sortedMonths[sortedMonths.length - 1];
  const prev = sortedMonths[sortedMonths.length - 2];
  const last3 = sortedMonths.slice(-3);

  // Build feature matrix: each row = [monthIndex, total, movingAvg, growthRate, frequency, weekendRatio]
  const featureMatrix = [];
  const targets = [];

  for (let i = 1; i < sortedMonths.length; i++) {
    const m = sortedMonths[i];
    const prevM = sortedMonths[i - 1];
    const slice3 = sortedMonths.slice(Math.max(0, i - 2), i + 1);
    const avg3 = slice3.reduce((s, x) => s + x.total, 0) / slice3.length;
    const growth = prevM.total > 0 ? (m.total - prevM.total) / prevM.total : 0;
    const wkRatio = m.total > 0 ? m.weekends / m.total : 0;

    featureMatrix.push([i, prevM.total, avg3, growth, m.count, wkRatio]);
    targets.push(m.total);
  }

  return {
    monthlyTotal: latest.total,
    movingAvg3: last3.reduce((s, m) => s + m.total, 0) / last3.length,
    growthRate: prev.total > 0 ? (latest.total - prev.total) / prev.total : 0,
    frequency: latest.count,
    weekendRatio: latest.total > 0 ? latest.weekends / latest.total : 0,
    historicalSeries: sortedMonths.map(m => m.total),
    featureMatrix,
    targets,
    // Next month's feature vector for prediction
    nextFeatures: [
      sortedMonths.length,
      latest.total,
      last3.reduce((s, m) => s + m.total, 0) / last3.length,
      prev.total > 0 ? (latest.total - prev.total) / prev.total : 0,
      latest.count,
      latest.total > 0 ? latest.weekends / latest.total : 0,
    ],
  };
};

// ═══════════════════════════════════════════════
// TRAIN ALL MODELS FOR A USER (saves to DB)
// ═══════════════════════════════════════════════
const trainAllModels = async (userId, Transaction) => {
  const categories = await Transaction.distinct('category', { user: userId, type: 'expense' });
  const results = { trained: 0, skipped: 0, categories: [] };

  for (const cat of categories) {
    const txs = await Transaction.find({ user: userId, category: cat, type: 'expense' }).sort({ date: 1 });
    const features = engineerFeatures(txs);

    if (!features || features.featureMatrix.length < 3) {
      results.skipped++;
      continue;
    }

    // Train Random Forest
    const rf = new RandomForest(15, 4, 2);
    rf.train(features.featureMatrix, features.targets);

    // Also train Linear Regression as fallback
    const lr = new LinearRegression();
    const X = features.historicalSeries.slice(0, -1).map((_, i) => i);
    const y = features.historicalSeries.slice(1);
    lr.train(X, y);

    // Calculate MAE
    let totalError = 0;
    for (let i = 0; i < features.featureMatrix.length; i++) {
      const pred = rf.predict(features.featureMatrix[i]);
      totalError += Math.abs(pred - features.targets[i]);
    }
    const mae = totalError / features.featureMatrix.length;

    const confidence = rf.r2 >= 0.7 ? 'High' : rf.r2 >= 0.4 ? 'Medium' : 'Low';

    // Save to MongoDB (upsert — update if exists, create if not)
    await TrainedModel.findOneAndUpdate(
      { user: userId, category: cat },
      {
        modelType: 'random_forest',
        parameters: {
          randomForest: rf.toJSON(),
          linearRegression: lr.toJSON(),
        },
        features: {
          monthlyTotal: Math.round(features.monthlyTotal),
          movingAvg3: Math.round(features.movingAvg3),
          growthRate: Math.round(features.growthRate * 100),
          frequency: features.frequency,
          weekendRatio: Math.round(features.weekendRatio * 100),
        },
        performance: {
          r2: Math.round(rf.r2 * 100) / 100,
          mae: Math.round(mae),
          sampleSize: features.featureMatrix.length,
          confidence,
        },
        lastTrained: new Date(),
        trainingSamples: txs.length,
      },
      { upsert: true, new: true }
    );

    results.trained++;
    results.categories.push({
      name: cat,
      r2: Math.round(rf.r2 * 100),
      mae: Math.round(mae),
      samples: txs.length,
      confidence,
    });
  }

  return results;
};

// ═══════════════════════════════════════════════
// GET PREDICTIONS (use cached model or auto-train)
// ═══════════════════════════════════════════════
const getMLPrediction = async (userId, Transaction) => {
  const categories = await Transaction.distinct('category', { user: userId, type: 'expense' });
  const results = {};
  const now = new Date();

  for (const cat of categories) {
    // Try to load saved model
    let savedModel = await TrainedModel.findOne({ user: userId, category: cat });

    // If no saved model, or model is older than 7 days, auto-train
    const needsTraining = !savedModel ||
      (new Date() - new Date(savedModel.lastTrained)) > 7 * 24 * 60 * 60 * 1000;

    if (needsTraining) {
      const txs = await Transaction.find({ user: userId, category: cat, type: 'expense' }).sort({ date: 1 });
      const features = engineerFeatures(txs);
      if (!features || features.featureMatrix.length < 3) continue;

      // Train and save
      const rf = new RandomForest(15, 4, 2);
      rf.train(features.featureMatrix, features.targets);

      const lr = new LinearRegression();
      const X = features.historicalSeries.slice(0, -1).map((_, i) => i);
      const y = features.historicalSeries.slice(1);
      lr.train(X, y);

      let totalError = 0;
      for (let i = 0; i < features.featureMatrix.length; i++) {
        totalError += Math.abs(rf.predict(features.featureMatrix[i]) - features.targets[i]);
      }
      const mae = totalError / features.featureMatrix.length;
      const confidence = rf.r2 >= 0.7 ? 'High' : rf.r2 >= 0.4 ? 'Medium' : 'Low';

      savedModel = await TrainedModel.findOneAndUpdate(
        { user: userId, category: cat },
        {
          modelType: 'random_forest',
          parameters: { randomForest: rf.toJSON(), linearRegression: lr.toJSON() },
          features: {
            monthlyTotal: Math.round(features.monthlyTotal),
            movingAvg3: Math.round(features.movingAvg3),
            growthRate: Math.round(features.growthRate * 100),
            frequency: features.frequency,
            weekendRatio: Math.round(features.weekendRatio * 100),
          },
          performance: { r2: Math.round(rf.r2 * 100) / 100, mae: Math.round(mae), sampleSize: features.featureMatrix.length, confidence },
          lastTrained: new Date(),
          trainingSamples: txs.length,
        },
        { upsert: true, new: true }
      );
    }

    // Use saved model to predict
    const txs = await Transaction.find({ user: userId, category: cat, type: 'expense' }).sort({ date: 1 });
    const features = engineerFeatures(txs);
    if (!features) continue;

    // Load Random Forest from saved params
    const rf = RandomForest.fromJSON(savedModel.parameters.randomForest);
    const rfPrediction = rf.predict(features.nextFeatures);

    // Load Linear Regression as comparison
    const lr = LinearRegression.fromJSON(savedModel.parameters.linearRegression);
    const lrPrediction = lr.predict(features.historicalSeries.length);

    // Ensemble: weighted average (RF gets 70%, LR gets 30%)
    const predicted = rfPrediction * 0.7 + lrPrediction * 0.3;

    // Budget risk
    const budgetDoc = await Budget.findOne({
      user: userId, category: cat, month: now.getMonth() + 1, year: now.getFullYear()
    });
    const budgetLimit = budgetDoc ? budgetDoc.limit : 0;
    let probability = 0, riskLevel = 'low';
    if (budgetLimit > 0) {
      probability = Math.min(100, Math.round((predicted / budgetLimit) * 100));
      if (probability > 100) riskLevel = 'high';
      else if (probability > 80) riskLevel = 'medium';
    }

    let trend = 'stable';
    if (features.growthRate > 0.05) trend = 'increasing';
    else if (features.growthRate < -0.05) trend = 'decreasing';

    results[cat] = {
      predicted_amount: Math.round(Math.max(0, predicted)),
      trend,
      confidence: savedModel.performance.confidence === 'High' ? Math.max(70, Math.round(rf.r2 * 100))
        : savedModel.performance.confidence === 'Medium' ? Math.max(40, Math.round(rf.r2 * 100))
        : Math.round(rf.r2 * 100),
      probability_of_exceeding: probability,
      risk_level: riskLevel,
      model_type: 'Random Forest + Linear Regression (Ensemble)',
      last_trained: savedModel.lastTrained,
      training_samples: savedModel.trainingSamples,
      features: {
        monthlyTotal: features.monthlyTotal,
        movingAvg3: Math.round(features.movingAvg3),
        growthRate: Math.round(features.growthRate * 100),
        frequency: features.frequency,
        weekendRatio: Math.round(features.weekendRatio * 100),
      },
    };
  }

  return results;
};

module.exports = { getMLPrediction, trainAllModels, LinearRegression, RandomForest };
