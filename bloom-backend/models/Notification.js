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
  message: {
    type: String,
    required: true,
    trim: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  // Optional: Link to related entity (e.g., Memory ID)
  relatedId: {
    type: mongoose.Schema.Types.ObjectId
  }
}, {
  timestamps: true
});

// INDEX: User's notification feed (Newest first)
notificationSchema.index({ userId: 1, createdAt: -1 });

// DATA RETENTION: 30 Days (Keep feed fresh, clean up old alerts)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Notification', notificationSchema);