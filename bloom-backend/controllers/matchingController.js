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

    // GUARDIAN FIX: Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    const { city, gender, ageRange } = user.matchPreferences;
    
    // Construct Query
    const query = {
      _id: { $ne: user._id },
      coupleId: null,
      isDiscoverable: true,
    };

    if (city) query['matchProfile.city'] = city;
    if (gender && gender !== 'Any') query['matchProfile.gender'] = gender;

    if (ageRange && ageRange.min && ageRange.max) {
      query['matchProfile.age'] = { $gte: ageRange.min, $lte: ageRange.max };
    }

    const suggestions = await User.find(query)
      .select('name avatar matchProfile.age matchProfile.city matchProfile.gender matchProfile.bio matchProfile.interests matchProfile.goal matchProfile.personalityType')
      .skip(skip)
      .limit(limit)
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

    if (toUserId === fromUserId.toString()) {
       return res.status(400).json({ success: false, error: 'Cannot send request to yourself' });
    }

    // 1. Sender Eligibility Check
    const fromUser = await User.findById(fromUserId);
    if (!fromUser || fromUser.coupleId || !fromUser.isDiscoverable) {
      return res.status(403).json({ 
        success: false, 
        error: 'You are not eligible for matching. Ensure you are single and discoverable.' 
      });
    }

    // 2. GUARDIAN FIX: DB-Level Daily Limit Enforcer (20/Day)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const dailyCount = await MatchRequest.countDocuments({
      fromUserId,
      createdAt: { $gte: todayStart }
    });

    if (dailyCount >= 20) {
      return res.status(429).json({
        success: false,
        error: 'Daily request limit reached (20/day). Please try again tomorrow.'
      });
    }

    // 3. Reverse Request Check
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

    // 4. Validate Target User
    const targetUser = await User.findById(toUserId);
    if (!targetUser || targetUser.coupleId || !targetUser.isDiscoverable) {
      return res.status(404).json({ success: false, error: 'User unavailable for matching.' });
    }

    // 5. Create Request
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
      const { requestId, action } = req.body; 
      const userId = req.user;

      // GUARDIAN FIX: Validate Action
      if (!['Accepted', 'Rejected'].includes(action)) {
        throw new Error('Invalid action. Must be Accepted or Rejected.');
      }

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

      // --- ACCEPT FLOW ---
      const userA = await User.findById(request.fromUserId).session(session);
      const userB = await User.findById(request.toUserId).session(session);

      if (userA.coupleId || userB.coupleId) {
        throw new Error('One of the users is no longer single.');
      }

      const sortedUsers = [userA._id, userB._id].sort((a, b) => 
        a.toString().localeCompare(b.toString())
      );

      const newCouple = await Couple.create([{
        users: sortedUsers,
        status: 'Active',
        startDate: Date.now(),
        score: 50
      }], { session });

      userA.coupleId = newCouple[0]._id;
      userA.isDiscoverable = false;
      userA.matchProfile = undefined; 
      await userA.save({ session });

      userB.coupleId = newCouple[0]._id;
      userB.isDiscoverable = false;
      userB.matchProfile = undefined;
      await userB.save({ session });

      request.status = 'Accepted';
      await request.save({ session });
    });

    res.status(200).json({ 
      success: true, 
      message: req.body.action === 'Accepted' ? 'It\'s a Match! Couple Created.' : 'Request Rejected.' 
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    session.endSession();
  }
};