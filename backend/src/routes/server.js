const express = require('express');
const router = express.Router();
const serverController = require('../controllers/serverController');
const { requireAdminAuth } = require('../middleware/auth');

// Public route to view server information
router.get('/info', serverController.getServerInfo);

// Public route to submit Aternos username for server startup access (anti-phishing protected)
router.post('/access-request', serverController.submitAccessRequest);

// Protected route to update server information
router.put('/settings', requireAdminAuth, serverController.updateServerSettings);

// Protected routes to manage Aternos access requests
router.get('/access-requests', requireAdminAuth, serverController.listAccessRequests);
router.put('/access-request/:id', requireAdminAuth, serverController.updateRequestStatus);
router.delete('/access-request/:id', requireAdminAuth, serverController.removeAccessRequest);

module.exports = router;
