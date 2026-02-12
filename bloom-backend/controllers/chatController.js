const Message = require('../models/Message');
const Couple = require('../models/Couple');
const User = require('../models/User');

// @desc    Send Message
// @route   POST /api/chat/send
// @access  Private
exports.sendMessage = async (req, res, next) => {
  try {
    const { text, mediaUrl, type } = req.body;

    // 1. Controller-Level Input Validation
    if (!text && !mediaUrl) {
      return res.status(400).json({ success: false, error: 'Message content required (text or media)' });
    }

    // 2. Fetch User
    const user = await User.findById(req.user);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.coupleId) {
      return res.status(400).json({ success: false, error: 'You are not in a relationship' });
    }

    // 3. Fetch Couple & Verify Status
    const couple = await Couple.findById(user.coupleId);

    if (!couple) {
      return res.status(404).json({ success: false, error: 'Relationship not found' });
    }

    if (couple.status !== 'Active') {
      return res.status(403).json({ success: false, error: 'Relationship is not active' });
    }

    // 4. Security: Strict Membership Verification
    // Ensure the sender is actually one of the users in the couple document
    const isMember = couple.users.some(id => id.equals(user._id));
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to this relationship' });
    }

    // 5. Create Message
    const message = await Message.create({
      senderId: user._id,
      coupleId: user.coupleId,
      text,
      mediaUrl,
      type
    });

    // Note: Socket.io emission will be handled in the Socket Service (Phase 4.3)
    // We do NOT update Love Tree/LastInteraction here to maintain Phase Discipline.

    res.status(201).json({
      success: true,
      data: message
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get Chat History
// @route   GET /api/chat/history
// @access  Private
exports.getMessages = async (req, res, next) => {
  try {
    const user = await User.findById(req.user);
    
    if (!user || !user.coupleId) {
      return res.status(400).json({ success: false, error: 'Not in a relationship' });
    }

    // 1. Pagination with Clamping
    const page = parseInt(req.query.page, 10) || 1;
    // Security: Clamp limit to max 100 to prevent DOS
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100); 
    const skip = (page - 1) * limit;

    // 2. Fetch Messages with Performance Optimization
    const messages = await Message.find({ coupleId: user.coupleId })
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean(); // Performance: Return plain JSON objects, skip Mongoose hydration

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};