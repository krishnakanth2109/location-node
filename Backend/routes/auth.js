import express from 'express';
import axios from 'axios';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import admin from '../config/firebase.js';

const router = express.Router();

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
    const apiKey = process.env.FIREBASE_API_KEY;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

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

// @route   POST api/auth/forgot-password
// @desc    Generate OTP for Password Reset
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Generate 6 digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP to DB (Expires in 5 mins defined in Model)
    await Otp.create({ email, otp: otpCode });

    // TODO: Send this OTP via Email Service (Nodemailer)
    console.log(`[OTP] for ${email}: ${otpCode}`);

    res.json({ msg: 'OTP generated. Check server logs (or email).' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/auth/reset-password
// @desc    Verify OTP and Change Password
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    // 1. Verify OTP
    const validOtp = await Otp.findOne({ email, otp });
    if (!validOtp) return res.status(400).json({ msg: 'Invalid or Expired OTP' });

    // 2. Find User
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // 3. Update Password in Firebase (Server-Side)
    await admin.auth().updateUser(user.firebaseUid, {
      password: newPassword
    });

    // 4. Delete OTP
    await Otp.deleteOne({ _id: validOtp._id });

    res.json({ msg: 'Password updated successfully. Please login.' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

export default router;