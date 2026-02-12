const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Couple = require('../models/Couple');

let io;

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.CLIENT_URL, // Strict CORS
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // --- MIDDLEWARE: CONNECTION AUTHENTICATION ---
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Fetch User (Stateless fetch, needed for Room ID)
      const user = await User.findById(decoded.id).select('coupleId name');

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (!user.coupleId) {
        return next(new Error('Authentication error: No active relationship'));
      }

      // Attach User to Socket Context
      socket.user = user;
      next();

    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // --- CONNECTION HANDLER ---
  io.on('connection', (socket) => {
    console.log(`Socket Connected: ${socket.user._id}`);

    // 1. Room Strategy (CRITICAL: Join Couple ID)
    const roomName = socket.user.coupleId.toString();
    socket.join(roomName);
    console.log(`User ${socket.user.name} joined room: ${roomName}`);

    // 2. Rate Limit Initialization (Per Socket)
    socket.data.messageCount = 0;
    socket.data.lastMessageWindow = Date.now();

    // --- EVENT: SEND MESSAGE ---
    socket.on('chat:send', async (payload) => {
      try {
        const { text, mediaUrl, type } = payload;

        // A. Rate Protection (5 msgs/sec)
        const now = Date.now();
        if (now - socket.data.lastMessageWindow > 1000) {
           // Reset window
           socket.data.messageCount = 0;
           socket.data.lastMessageWindow = now;
        }
        
        socket.data.messageCount++;
        
        if (socket.data.messageCount > 5) {
          return socket.emit('error', { message: 'Slow down! Message limit exceeded.' });
        }

        // B. Input Validation (Empty Message Risk)
        if (!text && !mediaUrl) {
          return socket.emit('error', { message: 'Message content required' });
        }

        // C. Double-Check Membership (Security Layer)
        // Although we checked on connection, checking here protects against stale sessions 
        // if we implemented session invalidation (future proofing). 
        // For MVP, socket.user.coupleId from handshake is the source of truth for THIS connection.

        // D. Save to Database (Source of Truth)
        const newMessage = await Message.create({
          senderId: socket.user._id,
          coupleId: socket.user.coupleId,
          text,
          mediaUrl,
          type
        });

        // E. Emit to Room (Real-time Delivery)
        // Emits to everyone in the room INCLUDING sender (for easy UI sync confirmation)
        io.to(roomName).emit('chat:receive', newMessage);

      } catch (error) {
        console.error('Socket Message Error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
      // No special logic required for MVP
      console.log(`Socket Disconnected: ${socket.user._id}`);
    });
  });
};

module.exports = { initSocket };