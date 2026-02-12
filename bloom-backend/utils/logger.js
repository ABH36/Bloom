const logger = {
  info: (message) => {
    console.log(`[${new Date().toISOString()}] [INFO] ${message}`);
  },
  error: (message, error) => {
    console.error(`[${new Date().toISOString()}] [ERROR] ${message}`, error ? `\nStack: ${error.stack}` : '');
  },
  warn: (message) => {
    console.warn(`[${new Date().toISOString()}] [WARN] ${message}`);
  }
};

module.exports = logger;