const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { 
  generateLoveId, 
  connectPartner, 
  getCoupleStatus 
} = require('../controllers/coupleController');

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/generate-id', generateLoveId);
router.post('/connect', connectPartner);
router.get('/status', getCoupleStatus);

module.exports = router;