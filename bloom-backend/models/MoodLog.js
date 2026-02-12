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
    type: String, // Format: YYYY-MM-DD (Ensures strict daily uniqueness)
    required: true
  }
}, {
  timestamps: true
});

// Constraint: One mood per user per day
moodLogSchema.index({ userId: 1, date: 1 }, { unique: true });

// Performance: Quick lookup for couple aggregation
moodLogSchema.index({ coupleId: 1, date: 1 });

module.exports = mongoose.model('MoodLog', moodLogSchema);