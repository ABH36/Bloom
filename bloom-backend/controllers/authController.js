const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const generateToken = require('../utils/generateToken');
const crypto = require('crypto');

// Helper: Hash OTP
const hashOtp = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

// @desc    Register user & Send OTP
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res, next) => {
  try {
    const { name, email, password, age, gender, city } = req.body;

    // 1. Generate 6-digit Numeric OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 Minutes
    const hashedOtp = hashOtp(otpCode);

    // 2. Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      if (user.isVerified) {
        // SCENARIO A: User exists & verified
        // Security: Return fake success to prevent enumeration.
        // Optional: Send "Login Reminder" email to maintain timing consistency & UX
        try {
          await sendEmail({
            email,
            subject: 'Bloom - Account Already Exists',
            message: `Hello ${user.name}, someone tried to register with this email. If it was you, please login.`
          });
        } catch (err) {
          // Silent fail for this email to not break the flow
          console.error('Login reminder email failed', err); 
        }

        return res.status(200).json({
          success: true,
          message: `OTP sent to ${email}` // Generic message
        });
      } else {
        // SCENARIO B: User exists but NOT verified (Retry logic)
        // Update existing user with new OTP
        user.otp = {
          code: hashedOtp,
          expiresAt: otpExpiry,
          attempts: 0
        };
        // Update other fields if changed (optional, keeping minimal for now)
        await user.save();
      }
    } else {
      // SCENARIO C: New User
      user = await User.create({
        name,
        email,
        password,
        age,
        gender,
        city,
        otp: {
          code: hashedOtp,
          expiresAt: otpExpiry,
          attempts: 0
        }
      });
    }

    // 3. Send Verification Email
    const message = `Your Bloom verification code is: ${otpCode}. It expires in 10 minutes.`;
    
    const emailSent = await sendEmail({
      email: user.email,
      subject: 'Bloom - Verify Your Account',
      message
    });

    if (!emailSent) {
      // If new user, delete them to prevent zombie accounts
      if (!user.isVerified) { 
         // Note: If it was a retry (Scenario B), we keep them but they just miss the email
         // Logic specific to new users:
         // await User.findByIdAndDelete(user._id); // Risk: Deleting Scenario B users? 
         // Safest: Just return error.
      }
      return res.status(500).json({ success: false, error: 'Email could not be sent.' });
    }

    res.status(200).json({
      success: true,
      message: `OTP sent to ${email}`
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Verify OTP & Activate Account
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Please provide email and OTP' });
    }

    // 1. Find User
    const user = await User.findOne({ email });

    if (!user) {
      // Security: Generic error to prevent enumeration (or use specific if strictly internal)
      return res.status(400).json({ success: false, error: 'Invalid details' });
    }

    // 2. OTP Null Safety
    if (!user.otp || !user.otp.code) {
      return res.status(400).json({ success: false, error: 'No OTP request found' });
    }

    // 3. Check Max Attempts
    if (user.otp.attempts >= 5) {
      return res.status(429).json({ success: false, error: 'Too many failed attempts. Request a new OTP.' });
    }

    // 4. Check Expiry
    if (Date.now() > user.otp.expiresAt) {
      // Clear expired OTP
      user.otp = undefined;
      await user.save();
      return res.status(400).json({ success: false, error: 'OTP expired' });
    }

    // 5. Validate Code (Compare Hash)
    const hashedInput = hashOtp(otp);
    
    if (user.otp.code !== hashedInput) {
      user.otp.attempts += 1;
      await user.save();
      return res.status(400).json({ success: false, error: 'Invalid OTP' });
    }

    // 6. Success: Activate User
    user.isVerified = true;
    user.otp = undefined; // Clear OTP data
    await user.save();

    // 7. Issue Token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        relationshipStatus: user.relationshipStatus
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Login User
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Please provide email and password' });
    }

    // 1. Find User (Include password)
    const user = await User.findOne({ email }).select('+password');

    // Security: Generic error message (Merging "User Not Found" and "Wrong Password")
    const genericError = 'Invalid credentials';

    if (!user) {
      return res.status(401).json({ success: false, error: genericError });
    }

    // 2. Check Password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, error: genericError });
    }

    // 3. Check Verification Status
    if (!user.isVerified) {
      return res.status(401).json({ success: false, error: 'Account not verified. Please verify OTP.' });
    }

    // 4. Issue Token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        relationshipStatus: user.relationshipStatus
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};