import admin from '../config/firebase.js';
import User from '../models/User.js';

export const verifyToken = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // 1. Verify token with Firebase
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // 2. Find user in MongoDB
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found in database' });
    }

    // 3. Attach user to request
    req.user = user;
    req.firebaseUser = decodedToken;
    next();
  } catch (err) {
    console.error('Auth Error:', err);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};