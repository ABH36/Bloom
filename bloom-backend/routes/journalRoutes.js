const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const { addJournal, getJournal } = require('../controllers/memoryJournalController');

const router = express.Router();

// Journal Entry Limit: 30 requests / 15 min
const journalEntryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many journal entries. Please wait a while.' }
});

router.use(protect);

// Routes (Mounted at /api/journal)
router.post('/', journalEntryLimiter, addJournal);
router.get('/', getJournal);

module.exports = router;