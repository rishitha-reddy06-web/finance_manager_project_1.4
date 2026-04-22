/**
 * Holt-Winters (Triple Exponential Smoothing) Implementation
 * Predicts the next N days based on Level, Trend, and Seasonality
 */
class HoltWinters {
  constructor(data, period = 7, alpha = 0.2, beta = 0.1, gamma = 0.3) {
    this.data = data;
    this.period = period; // Seasonality length (7 for weekly)
    this.alpha = alpha;   // Level smoothing
    this.beta = beta;     // Trend smoothing
    this.gamma = gamma;   // Seasonality smoothing
  }

  // Initial seasonal indices
  initialSeasonality() {
    const seasonals = new Array(this.period).fill(0);
    const nSeasons = Math.floor(this.data.length / this.period);
    const seasonAverages = new Array(nSeasons).fill(0);

    for (let j = 0; j < nSeasons; j++) {
      let sum = 0;
      for (let i = 0; i < this.period; i++) {
        sum += this.data[j * this.period + i];
      }
      seasonAverages[j] = sum / this.period;
    }

    for (let i = 0; i < this.period; i++) {
      let sumOfValsOverAvg = 0;
      for (let j = 0; j < nSeasons; j++) {
        sumOfValsOverAvg += this.data[j * this.period + i] - seasonAverages[j];
      }
      seasonals[i] = sumOfValsOverAvg / nSeasons;
    }
    return seasonals;
  }

  // Initial trend
  initialTrend() {
    let sum = 0;
    for (let i = 0; i < this.period; i++) {
      sum += (this.data[i + this.period] - this.data[i]) / this.period;
    }
    return sum / this.period;
  }

  predict(nToPredict) {
    if (this.data.length < this.period * 2) return null;

    const seasonals = this.initialSeasonality();
    let level = this.data[0];
    let trend = this.initialTrend();
    const result = [];
    const smoothSeasonals = [...seasonals];

    for (let i = 0; i < this.data.length + nToPredict; i++) {
      if (i >= this.data.length) {
        // Forecasting
        const m = i - this.data.length + 1;
        const val = (level + m * trend) + smoothSeasonals[i % this.period];
        result.push(Math.max(0, val));
      } else {
        // Training/Smoothing
        const lastLevel = level;
        const val = this.data[i];
        level = this.alpha * (val - smoothSeasonals[i % this.period]) + (1 - this.alpha) * (level + trend);
        trend = this.beta * (level - lastLevel) + (1 - this.beta) * trend;
        smoothSeasonals[i % this.period] = this.gamma * (val - level) + (1 - this.gamma) * smoothSeasonals[i % this.period];
      }
    }
    return result;
  }
}

/**
 * Generate 30-day forecast per category
 */
const getCategoryForecast = async (userId, Transaction) => {
  const categories = await Transaction.distinct('category', { user: userId, type: 'expense' });
  const forecastResults = {};
  
  // Last 180 days (6 months) for training
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 180);

  for (const cat of categories) {
    const txs = await Transaction.find({
      user: userId,
      category: cat,
      type: 'expense',
      date: { $gte: startDate }
    }).sort({ date: 1 });

    if (txs.length < 14) continue; // Not enough data for this category

    // Create daily daily map
    const dailyMap = {};
    txs.forEach(t => {
      const day = new Date(t.date).toISOString().split('T')[0];
      dailyMap[day] = (dailyMap[day] || 0) + t.amount;
    });

    // Fill gaps with 0
    const series = [];
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];
      series.push(dailyMap[dayStr] || 0);
    }

    const hw = new HoltWinters(series);
    const predictions = hw.predict(30);

    if (predictions) {
      const predictedTotal = Math.round(predictions.reduce((a, b) => a + b, 0));
      
      // Calculate actual spending in last 30 days to determine trend
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const lastMonthTotal = txs
        .filter(t => new Date(t.date) >= thirtyDaysAgo)
        .reduce((sum, t) => sum + t.amount, 0);

      let trend = 'stable';
      if (predictedTotal > lastMonthTotal * 1.1) trend = 'increase';
      else if (predictedTotal < lastMonthTotal * 0.9) trend = 'decrease';

      forecastResults[cat] = {
        total: predictedTotal,
        daily: predictions.map(v => Math.round(v * 100) / 100),
        confidence: txs.length > 30 ? 'High' : 'Medium',
        trend: trend,
        lastMonthActual: Math.round(lastMonthTotal)
      };
    }
  }

  return forecastResults;
};

module.exports = { HoltWinters, getCategoryForecast };
