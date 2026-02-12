const mongoose = require('mongoose');

const moodLogSchema = new mongoose.Schema({
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
  mood: {
    type: String,
    enum: ['Great', 'Good', 'Neutral', 'Bad', 'Fight'],
    required: true
  },
  date: {
    type: String, 
    required: true,
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'] // Strict Format
  }
}, {
  timestamps: true
});

// 1. Uniqueness Scope: One mood per user per couple per day
moodLogSchema.index({ userId: 1, coupleId: 1, date: 1 }, { unique: true });

// 2. Performance: Aggregation lookup
moodLogSchema.index({ coupleId: 1, date: 1 });

// 3. Data Retention: Auto-delete logs after 180 days (6 months)
moodLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 });

module.exports = mongoose.model('MoodLog', moodLogSchema);