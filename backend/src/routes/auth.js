const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAdminAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

router.post('/login', authLimiter, authController.login);
router.get('/me', requireAdminAuth, authController.getProfile);
router.post('/change-password', requireAdminAuth, authController.updatePassword);

module.exports = router;
