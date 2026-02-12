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

// 1. GET Feed
router.get('/', feedLimiter, getNotifications);

// 2. STATIC ROUTES FIRST (Critical: Prevent ID Collision)
// Marks all notifications as read
router.patch('/read-all', actionLimiter, markAllRead);

// 3. DYNAMIC ROUTES LAST
// Marks a specific notification as read
router.patch('/:id/read', actionLimiter, markRead);

module.exports = router;