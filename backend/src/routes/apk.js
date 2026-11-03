const express = require('express');
const router = express.Router();
const apkController = require('../controllers/apkController');
const { requireAdminAuth } = require('../middleware/auth');

// Public routes
router.get('/info', apkController.getPublishedApk);
router.get('/download', apkController.getDownloadUrl);

// Admin-only multipart upload lifecycle routes
router.post('/upload/initiate', requireAdminAuth, apkController.initiateUpload);
router.post('/upload/presign-part', requireAdminAuth, apkController.presignPart);
router.post('/upload/complete', requireAdminAuth, apkController.completeUpload);
router.post('/upload/abort', requireAdminAuth, apkController.abortUpload);

// Admin-only management routes
router.get('/all', requireAdminAuth, apkController.listAllApks);
router.delete('/:id', requireAdminAuth, apkController.deleteApk);

// Local simulation handlers (used only when testing locally without R2 credentials)
router.put('/mock-chunk-upload', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  // Simulate successful S3 chunk upload by returning an ETag
  const partNumber = req.query.partNumber || 1;
  const mockETag = `"mock-etag-part-${partNumber}-${Date.now()}"`;
  res.setHeader('ETag', mockETag);
  return res.status(200).send('OK');
});

router.get('/mock-download/:filename', (req, res) => {
  const filename = req.params.filename || 'minecraft.apk';
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  return res.send(`Simulated Minecraft APK Package (${filename}) for local testing.`);
});

module.exports = router;
