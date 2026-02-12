const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { uploadImage, deleteImage } = require('../controllers/uploadController');

const router = express.Router();

router.use(protect); // All uploads require login

// POST /api/upload - Expects form-data with key 'image'
router.post('/', upload.single('image'), uploadImage);

// DELETE /api/upload - Expects JSON { publicId: '...' }
router.delete('/', deleteImage);

module.exports = router;