const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  // --- PHASE 1: AUTHENTICATION CORE ---
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [50, 'Name can not be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ],
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false // Security: Do not return password by default
  },
  phone: {
    type: String,
    trim: true
  },
  // Profile Picture (Added for UI logic mentioned in Phase 8)
  avatar: {
    type: String, // Cloudinary URL
    default: 'no-photo.jpg'
  },
  
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },

  // Password Reset Tokens
  resetPasswordToken: String,
  resetPasswordExpire: Date,

  // --- PHASE 2: COUPLE ENGINE ---
  // The Love ID is used to connect partners (Base36, Uppercase)
  loveId: {
    type: String,
    uppercase: true,
    trim: true,
    index: true
  },
  // Reference to the active Couple document
  coupleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Couple',
    default: null,
    index: true // Fast lookup for "Am I in a relationship?"
  },

  // --- PHASE 8: SINGLES MATCHING SYSTEM ---
  
  // Master Switch: Must be TRUE and coupleId MUST be NULL to appear in searches
  isDiscoverable: {
    type: Boolean,
    default: false
  },

  // Public Profile for Matching
  matchProfile: {
    age: { 
      type: Number, 
      min: 18, 
      max: 100 
    },
    gender: { 
      type: String, 
      enum: ['Male', 'Female', 'Non-binary', 'Other'] 
    },
    city: { 
      type: String, 
      trim: true 
    },
    bio: { 
      type: String, 
      maxlength: [500, 'Bio cannot exceed 500 characters'], 
      trim: true 
    },
    interests: [{ 
      type: String, 
      trim: true 
    }],
    goal: { 
      type: String, 
      enum: ['Marriage', 'Serious Dating', 'Casual', 'Friendship', 'Not Sure'],
      default: 'Not Sure'
    },
    lifestyle: { 
      type: String, 
      enum: ['Active', 'Social', 'Homebody', 'Balanced'], 
      default: 'Balanced' 
    },
    // Added: Was missing in previous version but present in SRS
    personalityType: {
      type: String,
      trim: true
    }
  },

  // Preferences (Who they want to meet)
  matchPreferences: {
    ageRange: { 
      min: { type: Number, default: 18 }, 
      max: { type: Number, default: 50 } 
    },
    gender: { 
      type: String, 
      enum: ['Male', 'Female', 'Any'], 
      default: 'Any' 
    },
    city: { 
      type: String, 
      trim: true 
    } // If empty, implies "Anywhere"
  }

}, {
  timestamps: true
});

// --- INDEXES (PERFORMANCE & LOGIC) ---

// 1. Eligibility Index: Fast filtering for "Who is Single AND Looking?"
userSchema.index({ coupleId: 1, isDiscoverable: 1 });

// 2. Interest Matching: For scoring/recommendation algorithms
userSchema.index({ 'matchProfile.interests': 1 });

// 3. Location/Gender Filtering (Compound Index for Match Engine)
userSchema.index({ 
  'coupleId': 1, 
  'isDiscoverable': 1, 
  'matchProfile.city': 1, 
  'matchProfile.gender': 1 
});


// --- MIDDLEWARE & METHODS ---

// Encrypt password using bcrypt
userSchema.pre('save', async function(next) {
  // CRITICAL FIX: Added 'return' to stop execution if password is not modified
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next(); // Always call next() after hashing
});

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  // Note: Controller must use .select('+password') for this to work
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password token
userSchema.methods.getResetPasswordToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model('User', userSchema);