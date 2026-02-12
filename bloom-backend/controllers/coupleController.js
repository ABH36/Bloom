const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const Couple = require('../models/Couple');

// Helper: Generate 8-char Uppercase ID
const generateCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

// @desc    Generate Love ID
// @route   POST /api/couple/generate-id
// @access  Private
exports.generateLoveId = async (req, res, next) => {
  try {
    // 1. Check if already in a relationship
    if (req.user.coupleId) {
      return res.status(400).json({ success: false, error: 'You are already in a relationship.' });
    }

    // 2. Check if ID already exists (Return existing)
    if (req.user.loveId) {
      return res.status(200).json({ 
        success: true, 
        loveId: req.user.loveId,
        message: 'Existing Love ID retrieved' 
      });
    }

    // 3. Generate Unique ID (Retry logic for collision)
    let loveId;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      loveId = generateCode();
      // Check collision
      const existingUser = await User.findOne({ loveId });
      if (!existingUser) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ success: false, error: 'Could not generate unique ID. Try again.' });
    }

    // 4. Save to User
    req.user.loveId = loveId;
    await req.user.save();

    res.status(201).json({
      success: true,
      loveId
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Connect Partner (The Handshake)
// @route   POST /api/couple/connect
// @access  Private
exports.connectPartner = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { loveId } = req.body; // Partner's Love ID

    if (!loveId) {
      throw new Error('Please provide a Love ID');
    }

    // 1. Fetch Initiator (User A)
    const userA = await User.findById(req.user._id).session(session);

    // 2. Fetch Partner (User B)
    const userB = await User.findOne({ loveId }).session(session);

    // --- STRICT VALIDATIONS INSIDE TRANSACTION ---

    // Check Existence
    if (!userB) {
      throw new Error('Invalid Love ID');
    }

    // Check Self-Connection
    if (userA._id.equals(userB._id)) {
      throw new Error('You cannot connect with yourself');
    }

    // Check User A Status
    if (userA.coupleId) {
      throw new Error('You are already in a relationship');
    }

    // Check User B Status
    if (userB.coupleId) {
      throw new Error('This user is already taken');
    }

    // --- EXECUTION ---

    // 3. Create Couple Document
    const newCouple = await Couple.create([{
      users: [userA._id, userB._id],
      status: 'Active'
    }], { session });

    const coupleId = newCouple[0]._id;

    // 4. Update User A (Initiator)
    userA.coupleId = coupleId;
    userA.loveId = undefined; // Burn Code
    await userA.save({ session });

    // 5. Update User B (Partner)
    userB.coupleId = coupleId;
    userB.loveId = undefined; // Burn Code
    await userB.save({ session });

    // 6. Commit Transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Couple connected successfully! ❤️',
      coupleId
    });

  } catch (error) {
    // Abort on ANY error
    await session.abortTransaction();
    session.endSession();
    
    // Determine status code based on error type
    const statusCode = error.message.includes('Invalid') || error.message.includes('taken') ? 400 : 500;
    
    res.status(statusCode).json({ success: false, error: error.message });
  }
};

// @desc    Get Relationship Status
// @route   GET /api/couple/status
// @access  Private
exports.getCoupleStatus = async (req, res, next) => {
  try {
    // 1. Check if Single
    if (!req.user.coupleId) {
      return res.status(200).json({
        status: 'Single',
        loveId: req.user.loveId || null
      });
    }

    // 2. Fetch Couple Data
    const couple = await Couple.findById(req.user.coupleId).populate('users', 'name email city');

    if (!couple) {
      // Data Integrity Error (Edge Case: User has ID but Couple doc missing)
      req.user.coupleId = null;
      await req.user.save();
      return res.status(200).json({ status: 'Single', message: 'Relationship data not found. Resetting status.' });
    }

    // 3. Identify Partner
    const partner = couple.users.find(u => u._id.toString() !== req.user._id.toString());

    res.status(200).json({
      status: 'In Relationship',
      startDate: couple.startDate,
      partner: {
        name: partner.name,
        email: partner.email,
        city: partner.city
      },
      coupleId: couple._id
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};