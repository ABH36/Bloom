const multer = require('multer');

// Store file in memory (Buffer) - Best for serverless/cloud efficiency
const storage = multer.memoryStorage();

// File Filter (Images Only)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Limit: 5MB
});

module.exports = upload;