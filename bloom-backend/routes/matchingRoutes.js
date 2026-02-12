const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const { 
  updateMatchProfile, 
  getSuggestions, 
  sendRequest, 
  respondRequest 
} = require('../controllers/matchingController');

const router = express.Router();

// --- Rate Limiters ---

// Suggestions: 50 requests / 15 min (Browsing)
const suggestionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 50,
  message: { success: false, error: 'Too many suggestion refreshes. Please wait.' }
});

// Requests: 20 requests / DAY (Strict Anti-Spam)
const requestLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Daily request limit reached (20/day).' }
});

router.use(protect);

router.put('/profile', updateMatchProfile);
router.get('/suggestions', suggestionLimiter, getSuggestions);
router.post('/request', requestLimiter, sendRequest);
router.post('/respond', respondRequest); // Response doesn't need strict limiting

module.exports = router;