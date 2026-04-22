const mongoose = require('mongoose');

const TrainedModelSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  modelType: {
    type: String,
    enum: ['linear_regression', 'random_forest'],
    default: 'random_forest',
  },
  // Stored model parameters
  parameters: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  // Feature snapshot used during training
  features: {
    monthlyTotal: Number,
    movingAvg3: Number,
    growthRate: Number,
    frequency: Number,
    weekendRatio: Number,
  },
  // Performance metrics
  performance: {
    r2: Number,
    mae: Number,
    sampleSize: Number,
    confidence: { type: String, enum: ['High', 'Medium', 'Low'] },
  },
  lastTrained: {
    type: Date,
    default: Date.now,
  },
  trainingSamples: Number,
}, { timestamps: true });

// Compound index: one model per user per category
TrainedModelSchema.index({ user: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('TrainedModel', TrainedModelSchema);
