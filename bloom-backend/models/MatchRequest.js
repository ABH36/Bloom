const mongoose = require('mongoose');

const matchRequestSchema = new mongoose.Schema({
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected'],
    default: 'Pending'
  },
  message: {
    type: String,
    maxlength: 140
  },
  expiresAt: {
    type: Date,
    default: () => Date.now() + 24 * 60 * 60 * 1000 // 24 Hours
  }
}, { timestamps: true });

// --- GUARDIAN CRITICAL INDEXES ---

// 1. Prevent Duplicate Pending Requests (A -> B)
matchRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true, partialFilterExpression: { status: 'Pending' } });

// 2. Performance: "My Incoming Requests"
matchRequestSchema.index({ toUserId: 1, status: 1 });

// 3. TTL: Auto-delete exactly at expiresAt (24h life cycle)
matchRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MatchRequest', matchRequestSchema);