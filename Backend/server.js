import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import connectDB from './config/db.js';
import socketHandler from './sockets/socketHandler.js';

// Route Imports
import authRoutes from './routes/auth.js';
import tripRoutes from './routes/trip.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app); // Create HTTP server for Socket.io

// --- CORS CONFIGURATION ---
const allowedOrigins = [
  'https://location-tracker56.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// --- SOCKET.IO SETUP ---
const io = new Server(server, {
  cors: corsOptions // Apply same CORS to sockets
});

// Initialize Socket Logic
socketHandler(io);

// --- API ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/admin', adminRoutes);

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server started on port ${PORT}`));