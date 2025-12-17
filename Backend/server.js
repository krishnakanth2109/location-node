const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// --- App Initialization ---
const app = express();

// --- CORS CONFIGURATION (Updated) ---
// We allow your Netlify URL and Localhost (for testing)
const allowedOrigins = [
  'https://location-tracker56.netlify.app', // Your deployed Frontend
  'http://localhost:3000',                    // React Localhost
  'http://localhost:5173'                     // Vite Localhost (just in case)
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

app.use(express.json());

// Render sets the PORT env variable automatically
const PORT = process.env.PORT || 5000;

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected...'))
  .catch(err => {
      console.error('MongoDB Connection Error:', err);
      process.exit(1); 
  });

// --- Mongoose Schemas ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['employee', 'admin'], 
    default: 'employee'
  }
});
const User = mongoose.model('User', UserSchema);

const TripSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  path: { type: Array, default: [] },
  stops: { type: Array, default: [] },
});
const Trip = mongoose.model('Trip', TripSchema);


// --- Middlewares ---
const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user; 
    next();
  } catch (err) { 
    res.status(401).json({ msg: 'Token is not valid' }); 
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ msg: 'Access denied. Admin privileges required.' });
  }
};


// --- API ROUTES ---

// 1. Auth Routes
const authRouter = express.Router();

authRouter.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User with this email already exists' });

    user = new User({ name, email, password });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    const payload = { user: { id: user.id, role: user.role } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' }, (err, token) => {
      if (err) throw err;
      res.status(201).json({ token });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const payload = { user: { id: user.id, role: user.role } }; 

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});
app.use('/api/auth', authRouter);


// 2. Trip Routes
const tripRouter = express.Router();
tripRouter.use(authMiddleware);

tripRouter.post('/start', async (req, res) => {
  try {
    const newTrip = new Trip({ user: req.user.id, startTime: new Date() });
    const trip = await newTrip.save();
    res.json({ tripId: trip.id });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

tripRouter.post('/stop', async (req, res) => {
  const { tripId, path, stops } = req.body;
  try {
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ msg: 'Trip not found' });
    if (trip.user.toString() !== req.user.id) {
        return res.status(401).json({ msg: 'User not authorized for this trip' });
    }
    trip.endTime = new Date();
    trip.path = path;
    trip.stops = stops;
    await trip.save();
    res.json({ msg: 'Trip saved successfully', trip });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
app.use('/api/trips', tripRouter);


// 3. Admin Routes
const adminRouter = express.Router();
adminRouter.use(authMiddleware, adminMiddleware);

adminRouter.get('/employees', async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' }).select('-password');
    res.json(employees);
  } catch (err) { 
    console.error(err.message);
    res.status(500).send('Server Error'); 
  }
});

adminRouter.get('/trips/:employeeId', async (req, res) => {
  try {
    const trips = await Trip.find({ user: req.params.employeeId }).sort({ startTime: -1 });
    res.json(trips);
  } catch (err) { 
    console.error(err.message);
    res.status(500).send('Server Error'); 
  }
});
app.use('/api/admin', adminRouter);

// --- Start Server ---
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));