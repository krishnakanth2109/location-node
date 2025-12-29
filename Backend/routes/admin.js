import express from 'express';
import User from '../models/User.js';
import Trip from '../models/Trip.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/roleMiddleware.js';

const router = express.Router();

// Apply auth & admin check to all routes here
router.use(verifyToken, isAdmin);

// Get all employees
router.get('/employees', async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' });
    res.json(employees);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Get trip history for an employee
router.get('/trips/:employeeId', async (req, res) => {
  try {
    // We assume employeeId passed is the Mongo _id
    const trips = await Trip.find({ user: req.params.employeeId }).sort({ startTime: -1 });
    res.json(trips);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

export default router;