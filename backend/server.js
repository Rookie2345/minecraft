require('dotenv').config();
const express = require('express');
const { configureCors, configureHelmet, globalLimiter } = require('./src/middleware/security');
const { initDB } = require('./src/config/db');
const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

// Trust reverse proxies (such as Render)
app.set('trust proxy', 1);

// Security middleware
app.use(configureHelmet());
app.use(configureCors());

// Body parsing with safe size limits (API payloads only; large files go directly to Cloudflare R2)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Apply rate limiter to /api
app.use('/api', globalLimiter);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Minecraft Server Portal API',
    status: 'running',
    health: '/api/health',
    docs: 'https://github.com/Rookie2345/minecraft'
  });
});

// API Routes
app.use('/api', apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found.'
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.message || err);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message
  });
});

async function startServer() {
  try {
    await initDB();

    app.listen(PORT, HOST, () => {
      console.log(`===============================================`);
      console.log(` Minecraft Server Portal Backend is Online!`);
      console.log(` Listening on: http://${HOST}:${PORT}`);
      console.log(` Health check: http://${HOST}:${PORT}/api/health`);
      console.log(` Environment:  ${process.env.NODE_ENV || 'development'}`);
      console.log(`===============================================`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

startServer();
