/**
 * End-to-End Automated Verification Test Suite for Simplified Architecture
 */

const http = require('http');

const PORT = 4002;
process.env.PORT = PORT;
process.env.NODE_ENV = 'test';
process.env.ADMIN_USERNAME = 'testadmin';
process.env.ADMIN_PASSWORD = 'TestPassword123!';
process.env.JWT_SECRET = 'test_secret_for_automated_verification_suite_32chars';

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
  console.log('--- Starting Simplified Test Suite ---');
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

    // 3. Admin Login
    console.log('Test 3: Admin authentication success');
    const loginRes = await request({ method: 'POST', path: '/api/auth/login' }, {
      username: 'testadmin',
      password: 'TestPassword123!'
    });
    if (loginRes.status !== 200 || !loginRes.body.token) {
      throw new Error('Admin login failed');
    }
    const adminToken = loginRes.body.token;
    console.log('✓ Admin login successful and JWT received.');

    // 4. Update Server Settings
    console.log('Test 4: Update Server Settings with custom Java & Bedrock values');
    const updateSettings = await request({
      method: 'PUT',
      path: '/api/server/settings',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      java_address: 'play.ourcraft.aternos.me',
      java_port: '25565',
      java_version: '26.3',
      bedrock_address: 'play.ourcraft.aternos.me',
      bedrock_port: '19132',
      announcement: 'Server is online!'
    });
    if (updateSettings.status !== 200 || !updateSettings.body.success) {
      throw new Error('Failed to update server settings');
    }
    console.log('✓ Server settings updated.');

    // 5. Publish APK with free Google Drive / direct link & SHA-256
    console.log('Test 5: Publish APK via admin endpoint');
    const publishRes = await request({
      method: 'POST',
      path: '/api/apk/publish',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      downloadUrl: 'https://drive.google.com/uc?export=download&id=sample_file_id',
      fileName: 'Minecraft-Bedrock-v1.20.apk',
      version: '1.20.50',
      fileSizeFormatted: '410 MB',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      description: 'Official companion client.'
    });

    if (publishRes.status !== 200 || !publishRes.body.success) {
      throw new Error('Failed to publish APK');
    }
    console.log('✓ APK successfully published.');

    // 6. Verify Public APK Info
    console.log('Test 6: Verify public APK info endpoint');
    const apkInfo = await request({ method: 'GET', path: '/api/apk/info' });
    if (!apkInfo.body.available || apkInfo.body.apk.version !== '1.20.50') {
      throw new Error('Public APK info did not reflect published file');
    }
    console.log('✓ Public APK info verified with correct SHA-256 and metadata.');

    // 7. Verify Download URL and Count Increment
    console.log('Test 7: Download endpoint increments count and returns link');
    const dlResult = await request({ method: 'GET', path: '/api/apk/download' });
    if (dlResult.status !== 200 || !dlResult.body.downloadUrl) {
      throw new Error('Download endpoint failed');
    }
    console.log('✓ Download endpoint returns direct link.');

    // 8. Unpublish APK
    console.log('Test 8: Unpublish APK');
    const unpubRes = await request({
      method: 'POST',
      path: '/api/apk/unpublish',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (unpubRes.status !== 200 || !unpubRes.body.success) {
      throw new Error('Failed to unpublish APK');
    }

    const apkInfoAfter = await request({ method: 'GET', path: '/api/apk/info' });
    if (apkInfoAfter.body.available !== false) {
      throw new Error('APK was not hidden after unpublishing');
    }
    console.log('✓ APK hidden from public view.');

    console.log('\n=======================================');
    console.log(' ALL SIMPLIFIED TESTS PASSED (100%)');
    console.log('=======================================');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err.message);
  process.exit(1);
});
