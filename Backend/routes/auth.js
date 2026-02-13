import express from 'express';
import axios from 'axios';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import admin from '../config/firebase.js';

const router = express.Router();

// Firebase API Key from environment
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

// @route   POST api/auth/register
// @desc    Create User in Firebase & MongoDB (Server-Side)
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    // 1. Create User in Firebase
    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // 2. Create User in MongoDB
    const user = new User({
      name,
      email,
      firebaseUid: firebaseUser.uid,
      role: role || 'employee'
    });

    await user.save();

    res.status(201).json({ msg: 'User registered successfully. Please login.' });
  } catch (err) {
    console.error("Register Error:", err);
    if(err.code === 'auth/email-already-exists') {
        return res.status(400).json({ msg: 'Email already exists' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   POST api/auth/login
// @desc    Login via Firebase REST API (No Client SDK needed)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Check if mongo user exists first
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

    // 2. Exchange Email/Password for ID Token via Firebase REST API
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

    const response = await axios.post(url, {
      email,
      password,
      returnSecureToken: true
    });

    const { idToken, localId } = response.data;

    // 3. Return Token & User Info
    res.json({
      token: idToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        firebaseUid: localId
      }
    });

  } catch (err) {
    console.error("Login Error:", err.response ? err.response.data : err.message);
    res.status(400).json({ msg: 'Invalid Credentials' });
  }
});

// @route   POST api/auth/send-reset-email
// @desc    Send Firebase Password Reset Email (Uses Firebase's Built-in Email with OTP Code)
router.post('/send-reset-email', async (req, res) => {
  const { email } = req.body;

  try {
    // 1. Validate input
    if (!email) {
      return res.status(400).json({ msg: 'Email is required' });
    }

    // 2. Check if user exists in MongoDB
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    // For security, don't reveal if email exists or not
    if (!user) {
      return res.json({ 
        msg: 'If this email is registered, a password reset link has been sent.',
        success: true 
      });
    }

    // 3. Send password reset email using Firebase REST API
    // Firebase will automatically send an email with a reset link/code
    const resetUrl = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`;
    
    await axios.post(resetUrl, {
      requestType: 'PASSWORD_RESET',
      email: email
    });

    res.json({ 
      msg: 'Password reset email sent successfully. Check your inbox.',
      success: true 
    });

  } catch (err) {
    console.error('Send Reset Email Error:', err.response ? err.response.data : err.message);
    
    // Don't expose internal errors to user
    if (err.response?.data?.error?.message === 'EMAIL_NOT_FOUND') {
      return res.json({ 
        msg: 'If this email is registered, a password reset link has been sent.',
        success: true 
      });
    }
    
    res.status(500).json({ msg: 'Failed to send reset email. Please try again.' });
  }
});

// @route   POST api/auth/verify-reset-code
// @desc    Verify the password reset code from Firebase email
router.post('/verify-reset-code', async (req, res) => {
  const { oobCode } = req.body;

  try {
    if (!oobCode) {
      return res.status(400).json({ msg: 'Reset code is required' });
    }

    // Verify the reset code with Firebase
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${FIREBASE_API_KEY}`;
    
    const response = await axios.post(verifyUrl, {
      oobCode: oobCode
    });

    res.json({ 
      msg: 'Reset code verified successfully',
      email: response.data.email,
      success: true 
    });

  } catch (err) {
    console.error('Verify Reset Code Error:', err.response ? err.response.data : err.message);
    
    if (err.response?.data?.error?.message === 'INVALID_OOB_CODE') {
      return res.status(400).json({ msg: 'Invalid or expired reset code' });
    }
    
    res.status(400).json({ msg: 'Failed to verify reset code' });
  }
});

// @route   POST api/auth/confirm-password-reset
// @desc    Reset password using the code from email
router.post('/confirm-password-reset', async (req, res) => {
  const { oobCode, newPassword } = req.body;

  try {
    // 1. Validate input
    if (!oobCode || !newPassword) {
      return res.status(400).json({ msg: 'Reset code and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }

    // 2. Reset password using Firebase REST API
    const resetUrl = `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${FIREBASE_API_KEY}`;
    
    const response = await axios.post(resetUrl, {
      oobCode: oobCode,
      newPassword: newPassword
    });

    res.json({ 
      msg: 'Password reset successfully. You can now login with your new password.',
      success: true 
    });

  } catch (err) {
    console.error('Confirm Password Reset Error:', err.response ? err.response.data : err.message);
    
    const errorMessage = err.response?.data?.error?.message;
    
    if (errorMessage === 'INVALID_OOB_CODE') {
      return res.status(400).json({ msg: 'Invalid or expired reset code' });
    } else if (errorMessage === 'WEAK_PASSWORD') {
      return res.status(400).json({ msg: 'Password is too weak. Use at least 6 characters.' });
    }
    
    res.status(500).json({ msg: 'Failed to reset password. Please try again.' });
  }
});

// ============================================================================
// ALTERNATIVE: Custom OTP System (If you want to keep using your Otp model)
// ============================================================================

// @route   POST api/auth/forgot-password
// @desc    Generate Custom OTP for Password Reset (stored in MongoDB)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  try {
    if (!email) {
      return res.status(400).json({ msg: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    // For security, don't reveal if email exists
    if (!user) {
      return res.json({ 
        msg: 'If this email is registered, an OTP has been sent.',
        success: true 
      });
    }

    // Generate 6 digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTPs for this email
    await Otp.deleteMany({ email: email.toLowerCase().trim() });

    // Save new OTP to DB (Expires in 5 mins defined in Model)
    await Otp.create({ 
      email: email.toLowerCase().trim(), 
      otp: otpCode 
    });

    // Send OTP via Firebase Email (using custom email template)
    try {
      // Generate a custom token for this user
      const customToken = await admin.auth().createCustomToken(user.firebaseUid);
      
      // You can send custom email using Firebase Admin SDK
      // Or integrate with SendGrid, AWS SES, etc.
      
      // For now, log it (you should replace this with actual email sending)
      console.log(`[OTP] for ${email}: ${otpCode}`);
      
      // TODO: Implement email sending here
      // Example: await sendOTPEmail(email, otpCode, user.name);
      
    } catch (emailErr) {
      console.error('Email sending error:', emailErr);
    }

    res.json({ 
      msg: 'OTP sent successfully. Check your email.',
      success: true,
      // Remove this in production - for testing only:
      dev_otp: process.env.NODE_ENV === 'development' ? otpCode : undefined
    });

  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ msg: 'Server error. Please try again.' });
  }
});

// @route   POST api/auth/verify-otp
// @desc    Verify OTP without resetting password
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    if (!email || !otp) {
      return res.status(400).json({ msg: 'Email and OTP are required' });
    }

    // Find and verify OTP
    const validOtp = await Otp.findOne({ 
      email: email.toLowerCase().trim(), 
      otp: otp.trim() 
    });

    if (!validOtp) {
      return res.status(400).json({ 
        msg: 'Invalid or expired OTP',
        success: false 
      });
    }

    res.json({ 
      msg: 'OTP verified successfully',
      success: true 
    });

  } catch (err) {
    console.error('Verify OTP Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/auth/reset-password
// @desc    Reset Password using Custom OTP
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    // 1. Validate input
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ msg: 'Email, OTP, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }

    // 2. Verify OTP
    const validOtp = await Otp.findOne({ 
      email: email.toLowerCase().trim(), 
      otp: otp.trim() 
    });
    
    if (!validOtp) {
      return res.status(400).json({ msg: 'Invalid or expired OTP' });
    }

    // 3. Find User in MongoDB
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // 4. Update Password in Firebase using Admin SDK
    await admin.auth().updateUser(user.firebaseUid, {
      password: newPassword
    });

    // 5. Delete the used OTP
    await Otp.deleteOne({ _id: validOtp._id });

    res.json({ 
      msg: 'Password reset successfully. You can now login with your new password.',
      success: true 
    });

  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
});

// @route   POST api/auth/resend-otp
// @desc    Resend OTP to user's email
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ msg: 'Email is required' });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      return res.json({ 
        msg: 'If this email is registered, an OTP has been sent.',
        success: true 
      });
    }

    // Delete old OTPs
    await Otp.deleteMany({ email: email.toLowerCase().trim() });

    // Generate new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to database
    await Otp.create({ 
      email: email.toLowerCase().trim(), 
      otp: otpCode 
    });

    // Send email
    console.log(`[RESEND OTP] for ${email}: ${otpCode}`);
    
    // TODO: Implement email sending here

    res.json({ 
      msg: 'OTP resent successfully',
      success: true,
      dev_otp: process.env.NODE_ENV === 'development' ? otpCode : undefined
    });

  } catch (err) {
    console.error('Resend OTP Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;