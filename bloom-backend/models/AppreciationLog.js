const mongoose = require('mongoose');

const appreciationLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coupleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Couple',
    required: true
  },
  type: {
    type: String,
    enum: ['LoveYou', 'ThankYou', 'Sorry', 'MissYou', 'ProudOfYou'],
    required: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true
  }
}, {
  timestamps: true
});

// Performance: Quick lookup for daily limits & score calculation
appreciationLogSchema.index({ coupleId: 1, date: 1 });
appreciationLogSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('AppreciationLog', appreciationLogSchema);