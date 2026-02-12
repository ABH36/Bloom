const mongoose = require('mongoose');

const journalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true 
  },
  content: {
    type: String,
    required: [true, 'Journal entry cannot be empty'],
    trim: true,
    maxlength: [2000, 'Journal entry cannot exceed 2000 characters']
  },
  moodTag: {
    type: String,
    enum: ['Happy', 'Sad', 'Excited', 'Angry', 'Anxious', 'Calm', 'Neutral'],
    default: 'Neutral'
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true
});

// PERSONAL TIMELINE INDEX: Reliable sorting by creation time
journalSchema.index({ userId: 1, createdAt: -1 });

// DATA RETENTION: 1 Year (Personal logs can allow cleanup)
journalSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

module.exports = mongoose.model('Journal', journalSchema);