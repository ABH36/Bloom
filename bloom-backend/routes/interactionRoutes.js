const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const { 
  submitMood, 
  sendAppreciation, 
  getLoveStatus 
} = require('../controllers/interactionController');

const router = express.Router();

// --- Rate Limiters (Abuse Protection) ---
const moodLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, error: 'Too many mood requests, please try again later.' }
});

const appreciationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: { success: false, error: 'Too many appreciation requests, please try again later.' }
});

// --- Routes ---
router.use(protect); // Apply Auth Middleware to all

router.post('/mood', moodLimiter, submitMood);
router.post('/appreciation', appreciationLimiter, sendAppreciation);
router.get('/status', getLoveStatus); // No strict limit on reads (or use general limit)

module.exports = router;