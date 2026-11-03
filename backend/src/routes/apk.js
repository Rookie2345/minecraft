const express = require('express');
const router = express.Router();
const apkController = require('../controllers/apkController');
const { requireAdminAuth } = require('../middleware/auth');

// Public routes
router.get('/info', apkController.getPublishedApk);
router.get('/download', apkController.getDownloadUrl);

// Admin-protected routes
router.get('/admin-details', requireAdminAuth, apkController.getAdminApkDetails);
router.post('/publish', requireAdminAuth, apkController.publishApk);
router.post('/unpublish', requireAdminAuth, apkController.unpublishApk);

module.exports = router;
