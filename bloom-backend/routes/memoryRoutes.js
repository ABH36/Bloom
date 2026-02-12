const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const { addMemory, getMemories } = require('../controllers/memoryJournalController');

const router = express.Router();

// Memory Upload Limit: 10 requests / 15 min
const memoryUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10,
  message: { success: false, error: 'Too many memories uploaded. Please wait a while.' }
});

router.use(protect);

// Routes (Mounted at /api/memory)
router.post('/', memoryUploadLimiter, addMemory);
router.get('/', getMemories);

module.exports = router;