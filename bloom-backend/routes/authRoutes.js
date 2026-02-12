const express = require('express');
const rateLimit = require('express-rate-limit');
const { registerUser, verifyOtp, loginUser } = require('../controllers/authController');

const router = express.Router();

// --- Rate Limiters ---

// Limit: 5 requests per 15 minutes
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, 
  message: { success: false, error: 'Too many registration attempts. Please try again later.' }
});

// Limit: 10 requests per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many login attempts. Please try again later.' }
});

// Limit: 10 requests per 15 minutes
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many verification attempts. Please try again later.' }
});

// --- Routes ---

router.post('/register', registerLimiter, registerUser);
router.post('/verify-otp', verifyLimiter, verifyOtp);
router.post('/login', loginLimiter, loginUser);

module.exports = router;