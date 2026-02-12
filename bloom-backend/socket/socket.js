const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

let io;
// In-memory tracker for active connections per user
const userSocketCounts = {}; 

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.CLIENT_URL, // Strict CORS
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // --- MIDDLEWARE: AUTH & CONNECTION LIMIT ---
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Connection Limit Check (Max 3 devices/tabs per user)
      const userId = decoded.id;
      if (!userSocketCounts[userId]) {
        userSocketCounts[userId] = 0;
      }

      if (userSocketCounts[userId] >= 3) {
        return next(new Error('Too many active connections (Max 3). Close other tabs.'));
      }

      // Fetch User (Stateless)
      const user = await User.findById(userId).select('coupleId name');

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (!user.coupleId) {
        return next(new Error('Authentication error: No active relationship'));
      }

      // Attach User to Socket
      socket.user = user;
      next();

    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // --- CONNECTION HANDLER ---
  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    
    // Increment Connection Count
    userSocketCounts[userId]++;
    console.log(`Socket Connected: ${userId} | Active: ${userSocketCounts[userId]}`);

    // 1. Room Strategy (Stored in socket.data for safety)
    socket.data.roomName = socket.user.coupleId.toString();
    socket.join(socket.data.roomName);
    console.log(`User ${socket.user.name} joined room: ${socket.data.roomName}`);

    // 2. Rate Limit Initialization
    socket.data.messageCount = 0;
    socket.data.lastMessageWindow = Date.now();

    // --- EVENT: SEND MESSAGE ---
    socket.on('chat:send', async (payload) => {
      try {
        const { text, mediaUrl, type } = payload;

        // A. Rate Protection (5 msgs/sec)
        const now = Date.now();
        if (now - socket.data.lastMessageWindow > 1000) {
           socket.data.messageCount = 0;
           socket.data.lastMessageWindow = now;
        }
        socket.data.messageCount++;
        
        if (socket.data.messageCount > 5) {
          return socket.emit('error', { message: 'Slow down! Message limit exceeded.' });
        }

        // B. Payload Protection (Network Layer Guard)
        if (text && text.length > 2000) {
          return socket.emit('error', { message: 'Message too long (Max 2000 chars)' });
        }

        // C. Input Validation
        if (!text && !mediaUrl) {
          return socket.emit('error', { message: 'Message content required' });
        }

        // D. Save to Database (Source of Truth)
        const newMessage = await Message.create({
          senderId: socket.user._id,
          coupleId: socket.user.coupleId,
          text,
          mediaUrl,
          type
        });

        // E. Emit to Room (Using stored roomName)
        io.to(socket.data.roomName).emit('chat:receive', newMessage);

      } catch (error) {
        console.error('Socket Message Error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
      // Decrement Connection Count
      if (userSocketCounts[userId] > 0) {
        userSocketCounts[userId]--;
      }
      // Cleanup key if 0 to save memory
      if (userSocketCounts[userId] === 0) {
        delete userSocketCounts[userId];
      }
      console.log(`Socket Disconnected: ${userId}`);
    });
  });
};

module.exports = { initSocket };