import mongoose from 'mongoose';

const OtpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 } // Auto-delete after 5 minutes (300s)
});

export default mongoose.model('Otp', OtpSchema);