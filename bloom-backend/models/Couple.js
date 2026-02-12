const mongoose = require('mongoose');

const coupleSchema = new mongoose.Schema({
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  // Phase 2 Fields
  status: { type: String, enum: ['Active', 'Breakup', 'Archived'], default: 'Active' },
  startDate: { type: Date, default: Date.now },
  score: { type: Number, default: 50, min: 0, max: 100 },
  
  // Phase 3 Fields
  streak: { type: Number, default: 0 },
  lastInteraction: { type: Date, default: Date.now },
  level: { type: Number, default: 1 },

  // --- PHASE 9: CONFLICT RECOVERY MODE ---
  recoveryMode: {
    type: Boolean,
    default: false,
    index: true // Fast lookup for Insight Engine
  },
  recoveryStartedAt: {
    type: Date
  },
  recoveryLevel: {
    type: String,
    enum: ['Soft', 'Moderate', 'Critical'],
    default: 'Soft'
  }

}, {
  timestamps: true
});

// Indexes
coupleSchema.index({ users: 1 });
coupleSchema.index({ status: 1 });
// Phase 9 Performance Index
coupleSchema.index({ recoveryMode: 1 }); 

module.exports = mongoose.model('Couple', coupleSchema);