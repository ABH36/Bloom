const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const { 
  addMemory, 
  getMemories, 
  addJournal, 
  getJournal 
} = require('../controllers/memoryJournalController');

const router = express.Router();

// --- Rate Limiters ---

// Memory Upload: 10 requests / 15 min (Protect against Cloudinary spam/costs)
const memoryUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10,
  message: { success: false, error: 'Too many memories uploaded. Please wait a while.' }
});

// Journal Entry: 30 requests / 15 min (Protect DB storage)
const journalEntryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many journal entries. Please wait a while.' }
});

// --- Routes ---
router.use(protect); // Global Auth Guard

// Memory
router.post('/memory', memoryUploadLimiter, addMemory);
router.get('/memory', getMemories); // Read limit handled by general middleware or assumed safe

// Journal
router.post('/journal', journalEntryLimiter, addJournal);
router.get('/journal', getJournal);

module.exports = router;