const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const { sendMessage, getMessages } = require('../controllers/chatController');

const router = express.Router();

// --- Rate Limiters ---

// Sending Messages (REST Fallback)
// Limit: 30 requests per 15 minutes (Strict to prevent spam via API)
// Real-time chat via Sockets has its own per-second limit.
const chatSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 30,
  message: { success: false, error: 'Too many messages sent via API. Please slow down.' }
});

// Fetching History
// Limit: 100 requests per 15 minutes (Allow frequent refreshing if needed)
const chatHistoryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many history requests. Please try again later.' }
});

// --- Routes ---
router.use(protect); // All routes require authentication

router.post('/send', chatSendLimiter, sendMessage);
router.get('/history', chatHistoryLimiter, getMessages);

module.exports = router;