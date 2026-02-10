require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db.js');
const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

// Connect to Database
connectDB();

const app = express();

// --- SECURITY MIDDLEWARE ---
app.use(helmet()); // Secure Headers
app.use(cors()); // Allow Cross-Origin requests
app.use(express.json({ limit: '10kb' })); // Body parser (limit payload size)
app.use(mongoSanitize()); // Prevent NoSQL Injection
app.use(xss()); // Prevent XSS attacks

// Rate Limiting (100 requests per 10 mins)
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 100
});
app.use('/api', limiter);

// --- ROUTES ---
// app.use('/api/auth', require('./routes/authRoutes')); (We will add this next)

// --- ERROR HANDLING ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Server Error' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});