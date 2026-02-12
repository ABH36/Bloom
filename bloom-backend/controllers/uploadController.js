const { cloudinary } = require('../config/cloudinary');
const streamifier = require('streamifier'); // Native node stream helper

// @desc    Upload Single Image
// @route   POST /api/upload
// @access  Private
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Stream Upload Function
    const streamUpload = (fileBuffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'bloom_app', // All images go here
            resource_type: 'image',
          },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
      });
    };

    // Execute Upload
    const result = await streamUpload(req.file.buffer);

    res.status(200).json({
      success: true,
      data: {
        imageUrl: result.secure_url,
        publicId: result.public_id
      }
    });

  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    res.status(500).json({ success: false, error: 'Image upload failed' });
  }
};

// @desc    Delete Image
// @route   DELETE /api/upload
// @access  Private
exports.deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({ success: false, error: 'Public ID is required' });
    }

    await cloudinary.uploader.destroy(publicId);

    res.status(200).json({ success: true, message: 'Image deleted successfully' });

  } catch (error) {
    console.error('Cloudinary Delete Error:', error);
    res.status(500).json({ success: false, error: 'Image deletion failed' });
  }
};