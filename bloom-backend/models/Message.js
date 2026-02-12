const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  coupleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Couple',
    required: true
  },
  text: {
    type: String,
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  mediaUrl: {
    type: String,
    trim: true,
    match: [/^https?:\/\/.+/, 'Invalid media URL'] // Basic URL validation
  },
  type: {
    type: String,
    enum: ['text', 'image'],
    default: 'text'
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// 1. Pagination & History (Critical for Chat UI)
messageSchema.index({ coupleId: 1, createdAt: -1 });

// 2. Sender Verification & Analytics
messageSchema.index({ senderId: 1, coupleId: 1 });

// 3. Validation Hook: Text OR Media is required
messageSchema.pre('validate', function(next) {
  if (!this.text && !this.mediaUrl) {
    next(new Error('Message must contain text or media'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Message', messageSchema);