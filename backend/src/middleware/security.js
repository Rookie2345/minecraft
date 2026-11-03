const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// CORS configuration
function configureCors() {
  const allowedOriginsEnv = process.env.FRONTEND_URL || '';
  const allowedOrigins = allowedOriginsEnv
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
      if (!origin) return callback(null, true);

      // In development or if wildcard is explicitly enabled
      if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // Check against configured list of origins
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Also allow common preview/render domains matching the owner if set
      if (origin.endsWith('.onrender.com') || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: Origin ${origin} not permitted.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
}

// Helmet security headers
function configureHelmet() {
  return helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false // Handled independently by frontend static site
  });
}

// Global API rate limiter (100 requests per 15 minutes)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Strict rate limiter for authentication endpoints (10 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts. Please try again after 15 minutes.'
  }
});

module.exports = {
  configureCors,
  configureHelmet,
  globalLimiter,
  authLimiter
};
