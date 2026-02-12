const mongoose = require('mongoose');
const Couple = require('../models/Couple');
const User = require('../models/User');
const { updateCoupleScore } = require('../utils/scoreEngine');

// @desc    Get Recovery Status
// @route   GET /api/couple/recovery
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
exports.submitRecoveryAction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { type } = req.body; 
      const user = await User.findById(req.user).session(session);
      
      if (!user.coupleId) throw new Error('No relationship found');
      
      // 1. Verify Mode
      // We fetch without session first to check if update is needed, 
      // but strictly we should fetch inside session for consistency.
      const couple = await Couple.findById(user.coupleId).session(session);

      if (!couple.recoveryMode) {
        throw new Error('Couple is not in recovery mode');
      }

      // 2. Award Score (+2 Bonus)
      await updateCoupleScore(user.coupleId, 2, session);

      // 3. GUARDIAN FIX: Refetch Updated State
      // updateCoupleScore modified the doc, so we must fetch the FRESH version 
      // to check if we crossed the threshold.
      const updatedCouple = await Couple.findById(user.coupleId).session(session);

      // 4. Immediate Exit Check (Gamification)
      if (updatedCouple.score > 50) {
        updatedCouple.recoveryMode = false;
        updatedCouple.recoveryStartedAt = undefined;
        updatedCouple.recoveryLevel = undefined;
        await updatedCouple.save({ session });
      }
    });

    res.status(200).json({ success: true, message: 'Recovery action recorded! (+2 Score)' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    session.endSession();
  }
};