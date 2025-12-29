import mongoose from 'mongoose';

const TripSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  },
  path: { type: Array, default: [] },
  // --- NEW FIELDS ---
  distance: { type: Number, default: 0 }, // stored in km
  stoppedTime: { type: Number, default: 0 }, // stored in seconds
  stops: { type: Array, default: [] }
});

export default mongoose.model('Trip', TripSchema);