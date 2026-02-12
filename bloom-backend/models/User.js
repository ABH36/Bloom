const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
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
    index: true
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  age: {
    type: Number,
    required: [true, 'Please add age'],
    min: [16, 'Must be at least 16 years old']
  },
  gender: {
    type: String,
    required: [true, 'Please select gender'],
    enum: ['Male', 'Female', 'Non-binary', 'Other']
  },
  city: {
    type: String,
    required: [true, 'Please add city'],
    trim: true
  },
  // --- PHASE 1 FIELDS END ---

  // --- PHASE 2 FIELDS (Couple Engine) ---
  loveId: {
    type: String,
    unique: true, 
    sparse: true, // Allows multiple null values
    index: true,
    uppercase: true,
    trim: true,
    minlength: 8,
    maxlength: 8
  },
  coupleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Couple',
    default: null,
    index: true // Fast lookup for relationship status
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    code: String,
    expiresAt: Date,
    attempts: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for Frontend Convenience (Not stored in DB)
userSchema.virtual('relationshipStatus').get(function() {
  return this.coupleId ? 'In Relationship' : 'Single';
});

// Encrypt password using bcrypt
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);