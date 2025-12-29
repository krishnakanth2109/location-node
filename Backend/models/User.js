import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  firebaseUid: { type: String, required: true, unique: true }, // The seed script now populates this
  role: { 
    type: String, 
    enum: ['employee', 'admin'], 
    default: 'employee' 
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', UserSchema);