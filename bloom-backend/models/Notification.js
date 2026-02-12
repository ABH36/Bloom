const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['StreakWarning', 'HighRisk', 'WeeklyReport', 'PartnerAction'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  // Optional: Link to related entity
  relatedId: {
    type: mongoose.Schema.Types.ObjectId
  },
  // STRICT DATE for Daily Limit Check
  date: {
    type: String, // YYYY-MM-DD
    required: true
  }
}, {
  timestamps: true
});

// PERFORMANCE INDEX: Efficiently count "How many notifications today?"
notificationSchema.index({ userId: 1, date: 1 });

// DATA RETENTION: 30 Days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Notification', notificationSchema);