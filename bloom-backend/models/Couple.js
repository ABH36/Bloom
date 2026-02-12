const mongoose = require('mongoose');

const coupleSchema = new mongoose.Schema({
  users: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    required: true,
    validate: {
      validator: function(val) {
        // Must be exactly 2 distinct users
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
  }
}, {
  timestamps: true
});

// CRITICAL SECURITY: Prevent multiple active couples for the same pair
// This enforces that a specific pair of users can only have ONE 'Active' couple document.
coupleSchema.index(
  { users: 1, status: 1 }, 
  { unique: true, partialFilterExpression: { status: 'Active' } }
);

module.exports = mongoose.model('Couple', coupleSchema);