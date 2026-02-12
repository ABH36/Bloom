require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const cron = require('node-cron');

// --- LOCAL IMPORTS ---
const connectDB = require('./config/db');
const validateEnv = require('./config/envValidator');
const logger = require('./utils/logger');
const { initSocket } = require('./socket/socket');
const { runInsightEngine } = require('./services/insightEngine');

// --- ROUTE IMPORTS ---
const authRoutes = require('./routes/authRoutes');
const coupleRoutes = require('./routes/coupleRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const chatRoutes = require('./routes/chatRoutes');
const memoryRoutes = require('./routes/memoryRoutes');
const journalRoutes = require('./routes/journalRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// --- 1. VALIDATE ENVIRONMENT (Fail Fast) ---
validateEnv();

// --- 2. CONNECT DATABASE ---
connectDB();

const app = express();

// --- 3. PRODUCTION CONFIGURATION ---
// Trust Proxy: Critical for Rate Limiting on Render/AWS/Heroku
app.set('trust proxy', 1);

// --- 4. SECURITY MIDDLEWARE ---
app.use(helmet()); 
app.use(cors({
  origin: process.env.CLIENT_URL, // Strict Origin
  credentials: true
}));
app.use(express.json({ limit: '10kb' })); // Body limit
app.use(mongoSanitize()); // Prevent NoSQL Injection
app.use(xss()); // Prevent XSS Attacks

// --- 5. REQUEST LOGGER ---
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// --- 6. HEALTH CHECK (Load Balancer Support) ---
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    service: 'Bloom Backend'
  });
});

// --- 7. MOUNT ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/couple', coupleRoutes);
app.use('/api/love', interactionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/notifications', notificationRoutes);

// --- 8. CRON SCHEDULER (Intelligence Layer) ---
// Runs Daily at 02:00 UTC
// The Engine internally checks if it is Monday before running heavy analytics.
cron.schedule('0 2 * * *', () => {
  logger.info('[Cron] Triggering Insight Engine Job...');
  runInsightEngine();
});

// --- 9. GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  logger.error(err.message, err); // Log stack trace for debugging
  
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false, 
    error: err.message || 'Server Error' 
  });
});

const PORT = process.env.PORT || 5000;

// --- 10. START SERVER ---
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// --- 11. INITIALIZE SOCKET.IO ---
initSocket(server);

// --- 12. GRACEFUL SHUTDOWN (Safety) ---
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

// --- 13. CRASH PROTECTION ---
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