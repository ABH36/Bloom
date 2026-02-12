require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');

// Import Routes
const authRoutes = require('./routes/authRoutes');

// Connect to Database
connectDB();

const app = express();

// --- PRODUCTION PROXY SETTING ---
// Essential for Rate Limiting behind Render/AWS/Nginx
app.set('trust proxy', 1);

// --- SECURITY MIDDLEWARE ---
app.use(helmet()); 

// Restricted CORS
app.use(cors({
  origin: process.env.CLIENT_URL, // Must be set in .env
  credentials: true
}));

app.use(express.json({ limit: '10kb' })); 
app.use(mongoSanitize()); 
app.use(xss()); 

// --- MOUNT ROUTES ---
app.use('/api/auth', authRoutes);

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false, 
    error: 'Server Error' 
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});