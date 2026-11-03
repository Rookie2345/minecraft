const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const serverRoutes = require('./server');
const apkRoutes = require('./apk');

// Health check endpoint required by Render
router.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'minecraft-server-portal-api'
  });
});

router.use('/auth', authRoutes);
router.use('/server', serverRoutes);
router.use('/apk', apkRoutes);

module.exports = router;
