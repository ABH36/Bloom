const mongoose = require('mongoose');
const Memory = require('../models/Memory');
const Journal = require('../models/Journal');
const Couple = require('../models/Couple');
const User = require('../models/User');
const { updateCoupleScore } = require('../utils/scoreEngine');

// --- MEMORY CONTROLLERS ---

// @desc    Add a Relationship Memory
// @route   POST /api/memory
// @access  Private
exports.addMemory = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { imageUrl, publicId, note, date } = req.body;

      if (!imageUrl) {
        const error = new Error('Image URL is required for a memory');
        error.statusCode = 400;
        throw error;
      }

      const user = await User.findById(req.user).session(session);

      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      if (!user.coupleId) {
        const error = new Error('You are not in a relationship');
        error.statusCode = 400;
        throw error;
      }

      // STRICT SECURITY: Write-Side Verification
      const couple = await Couple.findById(user.coupleId).session(session);
      
      if (!couple) {
        const error = new Error('Relationship not found');
        error.statusCode = 404;
        throw error;
      }

      const isMember = couple.users.some(id => id.equals(user._id));
      if (!isMember) {
        const error = new Error('Unauthorized access to this relationship');
        error.statusCode = 403;
        throw error;
      }

      await Memory.create([{
        coupleId: user.coupleId,
        uploadedBy: user._id,
        imageUrl,
        publicId,
        note,
        date: date || Date.now()
      }], { session });

      await updateCoupleScore(user.coupleId, 3, session);
    });

    res.status(201).json({ success: true, message: 'Memory added! (+3 Love Score)' });

  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, error: error.message });
  } finally {
    session.endSession();
  }
};

// @desc    Get Memory Timeline
// @route   GET /api/memory
// @access  Private
exports.getMemories = async (req, res, next) => {
  try {
    const user = await User.findById(req.user);
    
    if (!user || !user.coupleId) {
      return res.status(400).json({ success: false, error: 'Not in a relationship' });
    }

    // STRICT SECURITY: Read-Side Verification
    // Prevent stale token access to couple data
    const couple = await Couple.findById(user.coupleId);
    
    if (!couple) {
      return res.status(404).json({ success: false, error: 'Relationship data not found' });
    }

    const isMember = couple.users.some(id => id.equals(user._id));
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Unauthorized access' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    const memories = await Memory.find({ coupleId: user.coupleId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate('uploadedBy', 'name')
      .lean();

    res.status(200).json({
      success: true,
      count: memories.length,
      data: memories
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// --- JOURNAL CONTROLLERS ---

// @desc    Add Private Journal Entry
// @route   POST /api/journal
// @access  Private
exports.addJournal = async (req, res, next) => {
  try {
    const { content, moodTag, date } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    const journal = await Journal.create({
      userId: req.user,
      content,
      moodTag,
      date: date || Date.now()
    });

    res.status(201).json({ success: true, data: journal });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get Private Journal
// @route   GET /api/journal
// @access  Private
exports.getJournal = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    const entries = await Journal.find({ userId: req.user })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      count: entries.length,
      data: entries
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};