const mongoose = require('mongoose');
const MoodLog = require('../models/MoodLog');
const AppreciationLog = require('../models/AppreciationLog');
const Couple = require('../models/Couple');
const User = require('../models/User');
const { updateCoupleScore } = require('../utils/scoreEngine');

// Helper: Get Today's Date in YYYY-MM-DD (UTC)
const getTodayStr = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString().split('T')[0];
};

// @desc    Submit Daily Mood
// @route   POST /api/love/mood
// @access  Private
exports.submitMood = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { mood } = req.body;
      const today = getTodayStr();

      // 1. Fetch User INSIDE Session (Critical for ACID & Auth Fix)
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

      // 2. Value Mapping
      let points = 0;
      if (mood === 'Great') points = 2;
      if (mood === 'Good') points = 1;
      if (mood === 'Neutral') points = 0;
      if (mood === 'Bad') points = -2;
      if (mood === 'Fight') points = -5;

      // 3. Create Log
      await MoodLog.create([{
        userId: user._id,
        coupleId: user.coupleId,
        mood,
        date: today
      }], { session });

      // 4. Update Score Engine
      await updateCoupleScore(user.coupleId, points, session);
    });

    res.status(200).json({ success: true, message: 'Mood tracked!' });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'You already submitted your mood today.' });
    }
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, error: error.message });
  } finally {
    session.endSession();
  }
};

// @desc    Send Appreciation
// @route   POST /api/love/appreciation
// @access  Private
exports.sendAppreciation = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { type } = req.body;
      const today = getTodayStr();

      // 1. Fetch User INSIDE Session
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

      // 2. Check Daily Limit (Max 5)
      const count = await AppreciationLog.countDocuments({
        userId: user._id,
        coupleId: user.coupleId,
        date: today
      }).session(session);

      if (count >= 5) {
        const error = new Error('Daily appreciation limit reached (5/5)');
        error.statusCode = 429;
        throw error;
      }

      // 3. Create Log
      await AppreciationLog.create([{
        userId: user._id,
        coupleId: user.coupleId,
        type,
        date: today
      }], { session });

      // 4. Update Score (+1 point)
      await updateCoupleScore(user.coupleId, 1, session);
    });

    res.status(200).json({ success: true, message: 'Appreciation sent! ❤️' });

  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, error: error.message });
  } finally {
    session.endSession();
  }
};

// @desc    Get Love Tree Status
// @route   GET /api/love/status
// @access  Private
exports.getLoveStatus = async (req, res, next) => {
  try {
    // 1. Fetch User (Read-Only, no transaction needed)
    const user = await User.findById(req.user).lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.coupleId) {
      return res.status(200).json({ status: 'Single' });
    }

    // 2. Fetch Couple Data
    const couple = await Couple.findById(user.coupleId)
      .populate('users', 'name')
      .lean();

    if (!couple) {
      return res.status(404).json({ success: false, error: 'Couple data not found' });
    }

    const partner = couple.users.find(u => u._id.toString() !== user._id.toString());
    const today = getTodayStr();

    // 3. Check if current user submitted mood today
    const moodLog = await MoodLog.findOne({
      userId: user._id,
      coupleId: couple._id,
      date: today
    }).lean();

    res.status(200).json({
      status: 'In Relationship',
      tree: {
        score: couple.score,
        stage: couple.stage,
        streak: couple.streak,
        lastInteractionDate: couple.lastInteractionDate
      },
      partnerName: partner ? partner.name : 'Partner',
      userMoodSubmitted: !!moodLog
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};