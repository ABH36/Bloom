const mongoose = require('mongoose');
const User = require('../models/User');
const MatchRequest = require('../models/MatchRequest');
const Couple = require('../models/Couple');

// @desc    Update Match Profile & Preferences
// @route   PUT /api/match/profile
exports.updateMatchProfile = async (req, res, next) => {
  try {
    const { isDiscoverable, matchProfile, matchPreferences } = req.body;
    const user = await User.findById(req.user);

    if (user.coupleId) {
      return res.status(403).json({ success: false, error: 'Couples cannot edit matching profiles.' });
    }

    if (isDiscoverable !== undefined) user.isDiscoverable = isDiscoverable;
    if (matchProfile) user.matchProfile = { ...user.matchProfile, ...matchProfile };
    if (matchPreferences) user.matchPreferences = { ...user.matchPreferences, ...matchPreferences };

    await user.save();
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get Matching Suggestions
// @route   GET /api/match/suggestions
exports.getSuggestions = async (req, res, next) => {
  try {
    const user = await User.findById(req.user);
    if (!user || user.coupleId) {
      return res.status(403).json({ success: false, error: 'Not eligible for matching.' });
    }

    const { city, gender } = user.matchPreferences;
    
    // Construct Query
    const query = {
      _id: { $ne: user._id }, // Not self
      coupleId: null,         // Must be single
      isDiscoverable: true,   // Must be opted-in
    };

    if (city) query['matchProfile.city'] = city;
    if (gender && gender !== 'Any') query['matchProfile.gender'] = gender;

    // Simple Interest Overlap Logic (Can be enhanced with Aggregation later)
    const suggestions = await User.find(query)
      .select('name matchProfile.age matchProfile.city matchProfile.gender matchProfile.bio matchProfile.interests matchProfile.goal')
      .limit(20)
      .lean();

    res.status(200).json({ success: true, count: suggestions.length, data: suggestions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Send Match Request
// @route   POST /api/match/request
exports.sendRequest = async (req, res, next) => {
  try {
    const { toUserId, message } = req.body;
    const fromUserId = req.user;

    // 1. Check Reverse Request (Critical Guardian Rule)
    // If B already requested A, don't create new request. Tell A to accept B.
    const reverseRequest = await MatchRequest.findOne({
      fromUserId: toUserId,
      toUserId: fromUserId,
      status: 'Pending'
    });

    if (reverseRequest) {
      return res.status(400).json({ 
        success: false, 
        error: 'This user already sent you a request! Please check your inbox.' 
      });
    }

    // 2. Validate Target User
    const targetUser = await User.findById(toUserId);
    if (!targetUser || targetUser.coupleId || !targetUser.isDiscoverable) {
      return res.status(404).json({ success: false, error: 'User unavailable for matching.' });
    }

    // 3. Create Request
    await MatchRequest.create({
      fromUserId,
      toUserId,
      message,
      status: 'Pending'
    });

    res.status(201).json({ success: true, message: 'Request sent successfully!' });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Request already pending.' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Respond to Request (Accept/Reject)
// @route   POST /api/match/respond
exports.respondRequest = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { requestId, action } = req.body; // action: 'Accepted' | 'Rejected'
      const userId = req.user;

      const request = await MatchRequest.findById(requestId).session(session);
      if (!request || request.status !== 'Pending') {
        throw new Error('Invalid or expired request');
      }

      if (request.toUserId.toString() !== userId.toString()) {
        throw new Error('Unauthorized');
      }

      if (action === 'Rejected') {
        request.status = 'Rejected';
        await request.save({ session });
        return; 
      }

      // --- ACCEPT FLOW (Couple Creation) ---
      
      // 1. Verify both are STILL single (Race condition check)
      const userA = await User.findById(request.fromUserId).session(session);
      const userB = await User.findById(request.toUserId).session(session);

      if (userA.coupleId || userB.coupleId) {
        throw new Error('One of the users is no longer single.');
      }

      // 2. Create Couple
      const newCouple = await Couple.create([{
        users: [userA._id, userB._id],
        status: 'Active',
        startDate: Date.now(),
        score: 50 // Initial Score
      }], { session });

      // 3. Update Users (Exit Matching Pool)
      userA.coupleId = newCouple[0]._id;
      userA.isDiscoverable = false; // Auto-hide
      userA.matchProfile = undefined; // Optional: Clear profile or keep hidden
      await userA.save({ session });

      userB.coupleId = newCouple[0]._id;
      userB.isDiscoverable = false;
      userB.matchProfile = undefined;
      await userB.save({ session });

      // 4. Update Request
      request.status = 'Accepted';
      await request.save({ session });
    });

    res.status(200).json({ success: true, message: req.body.action === 'Accepted' ? 'It\'s a Match! Couple Created.' : 'Request Rejected.' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    session.endSession();
  }
};