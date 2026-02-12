const mongoose = require('mongoose');
const Couple = require('../models/Couple');
const User = require('../models/User');
const { updateCoupleScore } = require('../utils/scoreEngine');

// @desc    Get Recovery Status
// @route   GET /api/couple/recovery
// @access  Private
exports.getRecoveryStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user.coupleId) return res.status(400).json({ error: 'No relationship found' });

    const couple = await Couple.findById(user.coupleId).select('recoveryMode recoveryLevel recoveryStartedAt score');

    if (!couple.recoveryMode) {
      return res.status(200).json({ 
        recoveryMode: false, 
        message: 'Relationship is healthy.' 
      });
    }

    const daysActive = Math.floor((Date.now() - new Date(couple.recoveryStartedAt)) / (1000 * 60 * 60 * 24));

    // Dynamic Suggestions based on Level
    let suggestions = [];
    if (couple.recoveryLevel === 'Soft') {
      suggestions = ['Send a gentle appreciation', 'Share a happy memory'];
    } else if (couple.recoveryLevel === 'Moderate') {
      suggestions = ['Complete a mood check', 'Read communication tips', 'Send 3 appreciations'];
    } else {
      suggestions = ['Take a 24h cool-down', 'Write a private reflection', 'Apologize for a specific action'];
    }

    res.status(200).json({
      success: true,
      recoveryMode: true,
      level: couple.recoveryLevel,
      daysActive,
      score: couple.score,
      suggestions
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Submit Recovery Action
// @route   POST /api/couple/recovery-action
// @access  Private
exports.submitRecoveryAction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { type } = req.body; // e.g., 'Appreciation', 'Reflection', 'Apology'
      const user = await User.findById(req.user).session(session);
      
      if (!user.coupleId) throw new Error('No relationship found');
      
      const couple = await Couple.findById(user.coupleId).session(session);

      if (!couple.recoveryMode) {
        throw new Error('Couple is not in recovery mode');
      }

      // 1. Log Action (Optional: Could store in a RecoveryLog model later)
      // For now, we trust the action and award points.

      // 2. Award Score (+2 Bonus)
      await updateCoupleScore(user.coupleId, 2, session);

      // 3. Immediate Exit Check (Gamification)
      // If this action pushed score > 50, exit immediately
      if (couple.score + 2 > 50) {
        couple.recoveryMode = false;
        couple.recoveryStartedAt = undefined;
        couple.recoveryLevel = undefined;
        await couple.save({ session });
      }
    });

    res.status(200).json({ success: true, message: 'Recovery action recorded! (+2 Score)' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    session.endSession();
  }
};