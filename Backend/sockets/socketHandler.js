import Trip from '../models/Trip.js';

const socketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket Connected: ${socket.id}`);

    // 1. Employee: Start Tracking
    // Client sends: { userId }
    socket.on('join_tracking', ({ userId }) => {
        socket.join(userId); // Join a room named after the User ID
        console.log(`User ${userId} joined tracking room.`);
    });

    // 2. Admin: Listen to specific employee or all
    socket.on('admin_monitor', () => {
        socket.join('admin_room');
        console.log(`Admin ${socket.id} joined monitoring room.`);
    });

    // 3. Employee: Send Location Update
    // Client sends: { userId, lat, lng, tripId }
    socket.on('location_update', async (data) => {
        const { userId, tripId, lat, lng } = data;
        
        try {
            // A. Emit to Admin in real-time
            io.to('admin_room').emit('receive_location', {
                userId,
                lat,
                lng,
                tripId,
                timestamp: new Date()
            });

            // B. Save to Database (Asynchronously - don't block the socket)
            if (tripId) {
                await Trip.findByIdAndUpdate(tripId, {
                    $push: { path: { lat, lng, timestamp: new Date() } }
                });
            }
        } catch (err) {
            console.error('Socket Location Error:', err);
        }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });
};

export default socketHandler;