const mongoose = require('mongoose');

const weeklyInsightSchema = new mongoose.Schema({
  coupleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Couple',
    required: true,
    index: true
  },
  weekStart: {
    type: Date,
    required: true
  },
  weekEnd: {
    type: Date,
    required: true
  },
  // --- Analytics Metrics ---
  averageMood: {
    type: Number,
    default: 0
  },
  interactionDays: {
    type: Number,
    default: 0
  },
  appreciationCount: {
    type: Number,
    default: 0
  },
  memoryCount: {
    type: Number,
    default: 0
  },
  fightCount: {
    type: Number,
    default: 0
  },
  scoreChange: {
    type: Number, // Can be negative
    default: 0
  },
  // --- Risk Assessment ---
  riskLevel: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Low'
  }
}, {
  timestamps: true
});

// INDEX: Fetch latest insight for a couple efficiently
weeklyInsightSchema.index({ coupleId: 1, weekStart: -1 });

// DATA RETENTION: 6 Months (approx 180 days)
weeklyInsightSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 });

module.exports = mongoose.model('WeeklyInsight', weeklyInsightSchema);