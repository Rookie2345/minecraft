const express = require('express');
const router = express.Router();
const serverController = require('../controllers/serverController');
const { requireAdminAuth } = require('../middleware/auth');

// Public route to view server information
router.get('/info', serverController.getServerInfo);

// Protected route to update server information
router.put('/settings', requireAdminAuth, serverController.updateServerSettings);

module.exports = router;
