const Message = require('../models/Message');
const Couple = require('../models/Couple');
const User = require('../models/User');

// @desc    Send Message
// @route   POST /api/chat/send
// @access  Private
exports.sendMessage = async (req, res, next) => {
  try {
    const { text, mediaUrl, type } = req.body;

    // 1. Fetch User (Correct Auth Pattern)
    const user = await User.findById(req.user);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.coupleId) {
      return res.status(400).json({ success: false, error: 'You are not in a relationship' });
    }

    // 2. Validate Couple Status (Optional: Cache this check if performance needed)
    const couple = await Couple.findById(user.coupleId);
    if (!couple || couple.status !== 'Active') {
      return res.status(403).json({ success: false, error: 'Relationship is not active' });
    }

    // 3. Create Message
    const message = await Message.create({
      senderId: user._id,
      coupleId: user.coupleId,
      text,
      mediaUrl,
      type
    });

    // 4. (Future) Update Last Interaction Date in Couple
    // Ideally, this should use the Score Engine utility to keep logic centralized
    // But for raw speed in chat, we might optimize later. 
    // For now, let's keep it simple.
    couple.lastInteractionDate = new Date();
    await couple.save();

    // 5. Response
    // Note: Socket.io emission will happen here in Step 4.3
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

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    // Fetch Messages
    const messages = await Message.find({ coupleId: user.coupleId })
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit);

    // Return reversed (Oldest to Newest) for frontend display if needed, 
    // but usually frontend handles sorting. Sending logical DB order is standard.
    
    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};