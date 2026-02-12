const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getRecoveryStatus, submitRecoveryAction } = require('../controllers/recoveryController');

const router = express.Router();

router.use(protect);

router.get('/', getRecoveryStatus);
router.post('/action', submitRecoveryAction);

module.exports = router;