require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const { initSocket } = require('./socket/socket'); // Import Socket

// Import Routes
const authRoutes = require('./routes/authRoutes');
const coupleRoutes = require('./routes/coupleRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const chatRoutes = require('./routes/chatRoutes'); // (Will be created in next step, placeholder)

// Connect to Database
connectDB();

const app = express();

// --- PRODUCTION PROXY SETTING ---
app.set('trust proxy', 1);

// --- SECURITY MIDDLEWARE ---
app.use(helmet()); 
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json({ limit: '10kb' })); 
app.use(mongoSanitize()); 
app.use(xss()); 

// --- MOUNT ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/couple', coupleRoutes);
app.use('/api/love', interactionRoutes);
// app.use('/api/chat', require('./routes/chatRoutes')); // (Step 4.4)

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false, 
    error: 'Server Error' 
  });
});

const PORT = process.env.PORT || 5000;

// Initialize Server & Socket
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Start Socket.io
initSocket(server);