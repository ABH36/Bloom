const mongoose = require('mongoose');

const weeklyInsightSchema = new mongoose.Schema({
  coupleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Couple',
    required: true
  },
  weekStart: {
    type: String, // YYYY-MM-DD (Monday) - Changed to String for strict uniqueness
    required: true
  },
  weekEnd: {
    type: String, // YYYY-MM-DD (Sunday)
    required: true
  },
  // --- Analytics Metrics ---
  averageMood: { type: Number, default: 0 },
  interactionDays: { type: Number, default: 0 },
  appreciationCount: { type: Number, default: 0 },
  memoryCount: { type: Number, default: 0 },
  fightCount: { type: Number, default: 0 },
  scoreChange: { type: Number, default: 0 },
  
  // --- Risk Assessment ---
  riskLevel: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Low'
  },
  // FRONTEND TRIGGER: Activates "Recovery Mode" UI
  actionRequired: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// CRITICAL: Prevent duplicate reports for the same week
weeklyInsightSchema.index({ coupleId: 1, weekStart: 1 }, { unique: true });

// DATA RETENTION: 6 Months
weeklyInsightSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 });

module.exports = mongoose.model('WeeklyInsight', weeklyInsightSchema);