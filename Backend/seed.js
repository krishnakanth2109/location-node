const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Important: Define the schema here exactly as it is in server.js
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['employee', 'admin'], default: 'employee' }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB Connected for seeding...');

    const adminEmail = "admin@example.com"; // CHANGE THIS TO YOUR ADMIN EMAIL
    const adminPassword = "password123";      // CHANGE THIS TO YOUR STRONG ADMIN PASSWORD

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('Admin user already exists.');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const admin = new User({
      name: "Admin User",
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
    });

    await admin.save();
    console.log('Admin user created successfully!');
  } catch (error) {
    console.error('Error seeding admin user:', error);
  } finally {
    mongoose.connection.close();
  }
};

createAdmin();