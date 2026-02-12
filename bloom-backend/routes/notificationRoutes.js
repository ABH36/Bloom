const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const { 
  getNotifications, 
  markRead, 
  markAllRead 
} = require('../controllers/notificationController');

const router = express.Router();

// --- Rate Limiters ---

// Feed Limit: 100 requests / 15 min (Allow frequent checking)
const feedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: { success: false, error: 'Too many requests. Please wait a while.' }
});

// Action Limit: 50 requests / 15 min (Marking read)
const actionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, error: 'Too many actions. Please wait a while.' }
});

router.use(protect);

router.get('/', feedLimiter, getNotifications);
router.patch('/:id/read', actionLimiter, markRead);
router.patch('/read-all', actionLimiter, markAllRead);

module.exports = router;