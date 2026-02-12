const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
  coupleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Couple',
    required: true,
    index: true 
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  imageUrl: {
    type: String,
    required: [true, 'Memory must have an image'],
    trim: true,
    match: [/^https?:\/\/.+/, 'Invalid image URL']
  },
  // Cloudinary Public ID (For future deletion/management)
  publicId: {
    type: String,
    trim: true
  },
  note: {
    type: String,
    trim: true,
    maxlength: [500, 'Note cannot exceed 500 characters']
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true
});

// TIMELINE INDEX: Get relationship history, newest first
memorySchema.index({ coupleId: 1, date: -1 });

// NOTE: No TTL Index. Memories are permanent.

module.exports = mongoose.model('Memory', memorySchema);