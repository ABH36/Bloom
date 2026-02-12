const mongoose = require('mongoose');

const coupleSchema = new mongoose.Schema({
  users: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    required: true,
    validate: {
      validator: function(val) {
        return val.length === 2 && val[0].toString() !== val[1].toString();
      },
      message: 'A couple must consist of exactly 2 distinct users'
    }
  },
  status: {
    type: String,
    enum: ['Active', 'Broken'],
    default: 'Active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  
  // --- PHASE 3 FIELDS (Love Tree Engine) ---
  score: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  },
  stage: {
    type: String,
    enum: ['Dry', 'Weak', 'Growing', 'Healthy', 'Bloom'],
    default: 'Growing'
  },
  streak: {
    type: Number,
    default: 0
  },
  lastInteractionDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
coupleSchema.index(
  { users: 1, status: 1 }, 
  { unique: true, partialFilterExpression: { status: 'Active' } }
);

module.exports = mongoose.model('Couple', coupleSchema);