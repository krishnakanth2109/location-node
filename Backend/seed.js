import mongoose from 'mongoose';
import dotenv from 'dotenv';
import admin from './config/firebase.js'; // Import your configured firebase instance
import User from './models/User.js'; // Use the actual User model

dotenv.config();

const seedAdmin = async () => {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');

    const adminData = {
      email: 'admin@example.com',
      password: 'password123', // Must be at least 6 chars
      name: 'Super Admin',
      role: 'admin'
    };

    // 2. Check/Create User in Firebase
    let firebaseUser;
    try {
      // Try to find if user exists in Firebase
      firebaseUser = await admin.auth().getUserByEmail(adminData.email);
      console.log('Admin already exists in Firebase.');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user in Firebase
        console.log('Creating Admin in Firebase...');
        firebaseUser = await admin.auth().createUser({
          email: adminData.email,
          password: adminData.password,
          displayName: adminData.name,
        });
      } else {
        throw error;
      }
    }

    // 3. Check/Create User in MongoDB
    let user = await User.findOne({ email: adminData.email });

    if (user) {
      // Update existing user to ensure they are admin and have correct UID
      user.role = 'admin';
      user.firebaseUid = firebaseUser.uid;
      user.name = adminData.name;
      await user.save();
      console.log('Existing MongoDB user updated to Admin.');
    } else {
      // Create new user in MongoDB
      user = new User({
        name: adminData.name,
        email: adminData.email,
        firebaseUid: firebaseUser.uid, // CRITICAL: This links Mongo to Firebase
        role: 'admin'
      });
      await user.save();
      console.log('Admin user created in MongoDB.');
    }

    console.log('-----------------------------------');
    console.log('Admin Seeded Successfully!');
    console.log(`Email: ${adminData.email}`);
    console.log(`Password: ${adminData.password}`);
    console.log('-----------------------------------');

    process.exit(0);
  } catch (err) {
    console.error('Seeding Error:', err);
    process.exit(1);
  }
};

seedAdmin();