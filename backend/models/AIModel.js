const mongoose = require('mongoose');

const AIModelSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  modelType: {
    type: String,
    enum: ['logistic_classification', 'budget_risk'],
    default: 'logistic_classification'
  },
  weights: {
    type: Map,
    of: mongoose.Schema.Types.Mixed // Stores weights per category and feature
  },
  vocabulary: {
    type: Array,
    of: String
  },
  idf: {
    type: Map,
    of: Number
  },
  lastTrained: {
    type: Date,
    default: Date.now
  },
  performance: {
    accuracy: Number,
    sampleSize: Number
  }
}, { timestamps: true });

module.exports = mongoose.model('AIModel', AIModelSchema);
