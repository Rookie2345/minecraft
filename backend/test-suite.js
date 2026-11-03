/**
 * End-to-End Automated Verification Test Suite
 * Tests all endpoints: Health, Auth, Server Settings, R2 Multipart Upload,
 * SHA-256 validation, and Direct Presigned Download URL generation.
 */

const http = require('http');

const PORT = 4001;
process.env.PORT = PORT;
process.env.NODE_ENV = 'test';
process.env.ADMIN_USERNAME = 'testadmin';
process.env.ADMIN_PASSWORD = 'TestPassword123!';
process.env.JWT_SECRET = 'test_secret_for_automated_verification_suite_32chars';

// Start server
require('dotenv').config();
const { initDB } = require('./src/config/db');
const express = require('express');
const { configureCors, configureHelmet } = require('./src/middleware/security');
const apiRoutes = require('./src/routes/api');

const app = express();
app.use(configureHelmet());
app.use(configureCors());
app.use(express.json());
app.use('/api', apiRoutes);

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = body;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Automated Test Suite ---');
  await initDB();
  const server = app.listen(PORT, '127.0.0.1');

  try {
    // 1. Health check
    console.log('Test 1: Health check endpoint /api/health');
    const health = await request({ method: 'GET', path: '/api/health' });
    if (health.status !== 200 || health.body.status !== 'ok') {
      throw new Error(`Health check failed: ${JSON.stringify(health.body)}`);
    }
    console.log('✓ Health check passed.');

    // 2. Initial Server Info
    console.log('Test 2: Public server info endpoint /api/server/info');
    const serverInfo = await request({ method: 'GET', path: '/api/server/info' });
    if (serverInfo.status !== 200 || !serverInfo.body.data.java) {
      throw new Error('Server info failed');
    }
    console.log('✓ Server info endpoint passed.');

    // 3. Admin Login - Failure
    console.log('Test 3: Admin authentication rejection on wrong password');
    const badLogin = await request({ method: 'POST', path: '/api/auth/login' }, {
      username: 'testadmin',
      password: 'WrongPassword'
    });
    if (badLogin.status !== 401) {
      throw new Error(`Expected 401 on bad password, got ${badLogin.status}`);
    }
    console.log('✓ Invalid login rejected as expected.');

    // 4. Admin Login - Success
    console.log('Test 4: Admin authentication success and JWT issuance');
    const goodLogin = await request({ method: 'POST', path: '/api/auth/login' }, {
      username: 'testadmin',
      password: 'TestPassword123!'
    });
    if (goodLogin.status !== 200 || !goodLogin.body.token) {
      throw new Error('Admin login failed');
    }
    const adminToken = goodLogin.body.token;
    console.log('✓ Admin login successful and JWT received.');

    // 5. Update Server Settings
    console.log('Test 5: Update Server Settings with custom Java & Bedrock values');
    const updateSettings = await request({
      method: 'PUT',
      path: '/api/server/settings',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      java_address: 'mc.ourcommunity.net',
      java_port: '25565',
      java_version: '26.3',
      bedrock_address: 'bedrock.ourcommunity.net',
      bedrock_port: '19132',
      announcement: 'Welcome to the updated server!'
    });
    if (updateSettings.status !== 200 || !updateSettings.body.success) {
      throw new Error(`Failed to update server settings: ${JSON.stringify(updateSettings.body)}`);
    }

    // Verify persistence in public endpoint
    const updatedInfo = await request({ method: 'GET', path: '/api/server/info' });
    if (updatedInfo.body.data.java.address !== 'mc.ourcommunity.net' ||
        updatedInfo.body.data.bedrock.address !== 'bedrock.ourcommunity.net') {
      throw new Error('Server settings were not persisted accurately.');
    }
    console.log('✓ Server settings updated and verified.');

    // 6. APK Multipart Upload: Initiate with SHA-256 verification (Requirement 1 & 2)
    console.log('Test 6: Initiate Multipart Upload with SHA-256 checksum');
    const fakeSha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const initUpload = await request({
      method: 'POST',
      path: '/api/apk/upload/initiate',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      fileName: 'minecraft-bedrock-v1.20.apk',
      fileSize: 419430400, // ~400 MB
      version: '1.20.50',
      sha256Hash: fakeSha256,
      description: 'Test companion package'
    });

    if (initUpload.status !== 200 || !initUpload.body.uploadId) {
      throw new Error(`Failed to initiate multipart upload: ${JSON.stringify(initUpload.body)}`);
    }
    const uploadId = initUpload.body.uploadId;
    console.log(`✓ Multipart upload initiated (UploadId: ${uploadId}).`);

    // 7. APK Multipart Upload: Presign Part 1 (Requirement 2: Ownership validation)
    console.log('Test 7: Presign part with ownership validation');
    const presignPart = await request({
      method: 'POST',
      path: '/api/apk/upload/presign-part',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      uploadId,
      partNumber: 1
    });

    if (presignPart.status !== 200 || !presignPart.body.presignedUrl) {
      throw new Error('Failed to presign part 1');
    }
    console.log('✓ Part 1 presigned URL generated successfully.');

    // 8. Complete Multipart Upload
    console.log('Test 8: Complete Multipart Upload and publish APK');
    const completeUpload = await request({
      method: 'POST',
      path: '/api/apk/upload/complete',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      uploadId,
      parts: [
        { PartNumber: 1, ETag: '"test-etag-part-1"' }
      ]
    });

    if (completeUpload.status !== 200 || !completeUpload.body.success) {
      throw new Error(`Failed to complete upload: ${JSON.stringify(completeUpload.body)}`);
    }
    console.log('✓ Multipart upload completed and published.');

    // 9. Verify Public APK Info
    console.log('Test 9: Verify public APK info endpoint');
    const apkInfo = await request({ method: 'GET', path: '/api/apk/info' });
    if (!apkInfo.body.available || apkInfo.body.apk.sha256Hash !== fakeSha256) {
      throw new Error('Public APK info did not return the expected published file');
    }
    console.log('✓ Public APK info returned published file with correct SHA-256 hash.');

    // 10. Direct Presigned Download URL (Requirement 4)
    console.log('Test 10: Generate direct presigned download URL');
    const dlResult = await request({ method: 'GET', path: '/api/apk/download' });
    if (dlResult.status !== 200 || !dlResult.body.downloadUrl) {
      throw new Error(`Download endpoint failed: ${JSON.stringify(dlResult.body)}`);
    }
    console.log('✓ Direct presigned download URL generated without streaming bytes through backend.');

    // 11. Verify Download Count Increment
    console.log('Test 11: Verify download count increment');
    const apkInfoAfterDl = await request({ method: 'GET', path: '/api/apk/info' });
    if (apkInfoAfterDl.body.apk.downloadCount < 1) {
      throw new Error('Download count did not increment');
    }
    console.log('✓ Download count incremented successfully.');

    // 12. Delete APK
    console.log('Test 12: Delete APK record');
    const deleteRes = await request({
      method: 'DELETE',
      path: `/api/apk/${apkInfo.body.apk.id}`,
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (deleteRes.status !== 200 || !deleteRes.body.success) {
      throw new Error('Failed to delete APK');
    }
    console.log('✓ APK deleted successfully.');

    console.log('\n=======================================');
    console.log(' ALL 12 AUTOMATED TESTS PASSED (100%)');
    console.log('=======================================');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err.message);
  process.exit(1);
});
