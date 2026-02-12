const validateEnv = () => {
  const required = [
    'MONGO_URI', 
    'JWT_SECRET', 
    'CLIENT_URL', 
    'NODE_ENV', 
    'PORT'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`[FATAL ERROR] Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1); // Stop server immediately
  }
  
  console.log('[SYSTEM] Environment variables verified.');
};

module.exports = validateEnv;