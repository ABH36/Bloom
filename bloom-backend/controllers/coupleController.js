const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const Couple = require('../models/Couple');

// Helper: Generate 8-char Alphanumeric (Base36)
const generateCode = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return result;
};

// @desc    Generate Love ID
// @route   POST /api/couple/generate-id
// @access  Private
exports.generateLoveId = async (req, res, next) => {
  try {
    const user = await User.findById(req.user);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.coupleId) {
      return res.status(400).json({ success: false, error: 'You are already in a relationship.' });
    }

    if (user.loveId) {
      return res.status(200).json({ 
        success: true, 
        loveId: user.loveId,
        message: 'Existing Love ID retrieved' 
      });
    }

    let loveId;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      loveId = generateCode();
      const existingUser = await User.findOne({ loveId });
      if (!existingUser) isUnique = true;
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ success: false, error: 'System busy. Please try again.' });
    }

    user.loveId = loveId;
    await user.save();

    res.status(201).json({ success: true, loveId });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Connect Partner (The Handshake)
// @route   POST /api/couple/connect
// @access  Private
exports.connectPartner = async (req, res, next) => {
  const session = await mongoose.startSession();
  
  try {
    let resultCoupleId;

    // Use withTransaction for auto-retries on transient errors
    await session.withTransaction(async () => {
      const { loveId } = req.body;

      if (!loveId) {
        const error = new Error('Please provide a Love ID');
        error.statusCode = 400;
        throw error;
      }

      // 1. Fetch Users inside Session
      const userA = await User.findById(req.user).session(session);
      const userB = await User.findOne({ loveId: loveId.toUpperCase() }).session(session);

      // --- STRICT VALIDATIONS ---
      if (!userA) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      if (!userB) {
        const error = new Error('Invalid Love ID');
        error.statusCode = 404;
        throw error;
      }

      if (userA._id.equals(userB._id)) {
        const error = new Error('You cannot connect with yourself');
        error.statusCode = 400;
        throw error;
      }

      if (userA.coupleId) {
        const error = new Error('You are already in a relationship');
        error.statusCode = 400;
        throw error;
      }

      if (userB.coupleId) {
        const error = new Error('This user is already taken');
        error.statusCode = 409; // Conflict
        throw error;
      }

      // 2. Deterministic Sorting for Unique Index
      // Convert to string -> Sort -> Convert back to ObjectId
      const sortedUsers = [userA._id.toString(), userB._id.toString()]
        .sort()
        .map(id => new mongoose.Types.ObjectId(id));

      // 3. Create Couple (Array format required for transactions)
      const newCouple = await Couple.create([{
        users: sortedUsers,
        status: 'Active',
        startDate: Date.now()
      }], { session });

      resultCoupleId = newCouple[0]._id;

      // 4. Update Users & Burn Codes
      userA.coupleId = resultCoupleId;
      userA.loveId = undefined;
      await userA.save({ session });

      userB.coupleId = resultCoupleId;
      userB.loveId = undefined;
      await userB.save({ session });
    });

    // Transaction Committed Automatically by withTransaction
    res.status(200).json({
      success: true,
      message: 'Couple connected successfully! ❤️',
      coupleId: resultCoupleId
    });

  } catch (error) {
    // Handle Duplicate Key Error (Race Condition / Integrity)
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false, 
        error: 'Connection conflict. One of the users is already active in a couple.' 
      });
    }

    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, error: error.message });
  } finally {
    session.endSession();
  }
};

// @desc    Get Relationship Status
// @route   GET /api/couple/status
// @access  Private
exports.getCoupleStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.coupleId) {
      return res.status(200).json({
        status: 'Single',
        loveId: user.loveId || null
      });
    }

    const couple = await Couple.findById(user.coupleId).populate('users', 'name email city');

    if (!couple) {
      // Data Integrity Fallback
      user.coupleId = null;
      await user.save();
      return res.status(200).json({ status: 'Single', message: 'Relationship data missing. Resetting.' });
    }

    // Identify Partner
    const partner = couple.users.find(u => u._id.toString() !== user._id.toString());

    res.status(200).json({
      status: 'In Relationship',
      coupleId: couple._id,
      startDate: couple.startDate,
      partner: partner ? {
        name: partner.name,
        email: partner.email,
        city: partner.city
      } : null
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};