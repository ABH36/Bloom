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
    type: String, 
    required: true,
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD']
  }
}, {
  timestamps: true
});

// 1. Daily Limit Check: Efficient counting for "Max 5 per day"
appreciationLogSchema.index({ userId: 1, coupleId: 1, date: 1 });

// 2. Performance: Score calculation
appreciationLogSchema.index({ coupleId: 1, date: 1 });

// 3. Data Retention: Auto-delete logs after 180 days
appreciationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 });

module.exports = mongoose.model('AppreciationLog', appreciationLogSchema);