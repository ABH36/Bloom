require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose'); // Needed for graceful shutdown
const connectDB = require('./config/db');
const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const { initSocket } = require('./socket/socket');
const validateEnv = require('./config/envValidator');
const logger = require('./utils/logger');

// --- 1. VALIDATE ENVIRONMENT (Fail Fast) ---
validateEnv();

// Import Routes
const authRoutes = require('./routes/authRoutes');
const coupleRoutes = require('./routes/coupleRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const chatRoutes = require('./routes/chatRoutes');
const memoryJournalRoutes = require('./routes/memoryJournalRoutes');
const memoryRoutes = require('./routes/memoryRoutes');
const journalRoutes = require('./routes/journalRoutes');

// Connect to Database
connectDB();

const app = express();

// --- PROXY SETTING (Critical for Rate Limiting) ---
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

// --- REQUEST LOGGER (Middleware) ---
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// --- MOUNT ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/couple', coupleRoutes);
app.use('/api/love', interactionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', memoryJournalRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/journal', journalRoutes);

// --- HEALTH CHECK ENDPOINT (Step 5.1) ---
// Used by Render/AWS Load Balancers to verify uptime
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    service: 'Bloom Backend'
  });
});

// --- GLOBAL ERROR HANDLER (Step 5.5) ---
app.use((err, req, res, next) => {
  logger.error(err.message, err); // Log stack trace
  
  res.status(err.statusCode || 500).json({
    success: false, 
    error: err.message || 'Server Error' 
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Initialize Socket.io
initSocket(server);

// --- GRACEFUL SHUTDOWN (Step 5.4) ---
// Handles SIGTERM (Render/Heroku stop signal) and SIGINT (Ctrl+C)
const gracefulShutdown = async (signal) => {
  logger.warn(`Received ${signal}. Closing HTTP server and DB connection...`);
  
  server.close(async () => {
    logger.info('HTTP server closed.');
    
    try {
      await mongoose.connection.close(false);
      logger.info('MongoDB connection closed.');
      process.exit(0);
    } catch (err) {
      logger.error('Error closing MongoDB connection', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle Uncaught Exceptions (Crash safety)
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...', err);
  server.close(() => {
    process.exit(1);
  });
});