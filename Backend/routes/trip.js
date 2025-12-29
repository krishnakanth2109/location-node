import express from 'express';
import Trip from '../models/Trip.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(verifyToken);

// 1. Start Trip
router.post('/start', async (req, res) => {
  try {
    const activeTrip = await Trip.findOne({ user: req.user._id, status: 'active' });
    if(activeTrip) return res.json({ tripId: activeTrip._id, msg: "Resuming" });

    const newTrip = new Trip({
      user: req.user._id,
      startTime: new Date(),
      status: 'active'
    });
    const trip = await newTrip.save();
    res.json({ tripId: trip._id });
  } catch (err) { res.status(500).send('Server Error'); }
});

// 2. Stop Trip (UPDATED to save stats)
router.post('/stop', async (req, res) => {
  const { tripId, path, distance, stoppedTime, stops } = req.body;
  try {
    const trip = await Trip.findOne({ _id: tripId, user: req.user._id });
    if (!trip) return res.status(404).json({ msg: 'Trip not found' });

    trip.endTime = new Date();
    trip.status = 'completed';
    trip.path = path;
    // Save the calculated stats from frontend
    trip.distance = distance || 0;
    trip.stoppedTime = stoppedTime || 0;
    trip.stops = stops || [];

    await trip.save();
    res.json({ msg: 'Trip completed', trip });
  } catch (err) { res.status(500).send('Server Error'); }
});

// 3. GET STATS (For DashboardHome)
router.get('/stats', async (req, res) => {
    try {
        const trips = await Trip.find({ user: req.user._id, status: 'completed' });
        
        const totalTrips = trips.length;
        const totalDistance = trips.reduce((acc, curr) => acc + (curr.distance || 0), 0);
        const totalWaitTime = trips.reduce((acc, curr) => acc + (curr.stoppedTime || 0), 0);
        
        // Calculate last 7 days distance for the chart
        const last7Days = [0, 0, 0, 0, 0, 0, 0];
        const now = new Date();
        
        trips.forEach(trip => {
            const tripDate = new Date(trip.startTime);
            const diffTime = Math.abs(now - tripDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if(diffDays <= 7) {
                // simple logic to map to array index (0 is today, 6 is 7 days ago)
                last7Days[7 - diffDays] += (trip.distance || 0);
            }
        });

        res.json({
            totalTrips,
            totalDistance: totalDistance.toFixed(2),
            avgWaitTime: totalTrips > 0 ? (totalWaitTime / totalTrips / 60).toFixed(0) : 0, // in minutes
            chartData: last7Days
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// 4. GET HISTORY (For TripsChat)
router.get('/history', async (req, res) => {
    try {
        // Get last 10 trips
        const trips = await Trip.find({ user: req.user._id })
                                .sort({ startTime: -1 })
                                .limit(10);
        res.json(trips);
    } catch (err) { res.status(500).send('Server Error'); }
});

export default router;