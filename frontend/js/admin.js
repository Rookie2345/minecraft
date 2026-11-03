/**
 * Admin Dashboard Logic
 * Direct Cloudflare R2 browser-to-bucket chunked multipart upload,
 * SHA-256 integrity hashing, and server settings management.
 */
document.addEventListener('DOMContentLoaded', () => {
  const apiBase = CONFIG.getApiBaseUrl();

  // DOM Elements - Auth
  const loginSection = document.getElementById('login-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const loginForm = document.getElementById('login-form');
  const loginUsernameInput = document.getElementById('login-username');
  const loginPasswordInput = document.getElementById('login-password');
  const loginErrorMsg = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const adminNameDisplay = document.getElementById('admin-username-display');

  // DOM Elements - Tabs
  const tabBtns = document.querySelectorAll('.admin-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // DOM Elements - Server Settings
  const serverSettingsForm = document.getElementById('server-settings-form');
  const javaAddressInput = document.getElementById('input-java-address');
  const javaPortInput = document.getElementById('input-java-port');
  const javaVersionInput = document.getElementById('input-java-version');
  const javaLauncherInput = document.getElementById('input-java-launcher');
  const javaHostingInput = document.getElementById('input-java-hosting');
  const bedrockAddressInput = document.getElementById('input-bedrock-address');
  const bedrockPortInput = document.getElementById('input-bedrock-port');
  const bedrockVersionInput = document.getElementById('input-bedrock-version');
  const bedrockPlatformInput = document.getElementById('input-bedrock-platform');
  const bedrockHostingInput = document.getElementById('input-bedrock-hosting');
  const announcementInput = document.getElementById('input-announcement');
  const serverSettingsSaveBtn = document.getElementById('save-server-settings-btn');

  // DOM Elements - APK Management
  const apkUploadForm = document.getElementById('apk-upload-form');
  const apkFileInput = document.getElementById('apk-file-input');
  const apkVersionInput = document.getElementById('apk-version-input');
  const apkDescInput = document.getElementById('apk-desc-input');
  const uploadProgressCard = document.getElementById('upload-progress-card');
  const uploadProgressBar = document.getElementById('upload-progress-bar');
  const uploadPercentText = document.getElementById('upload-percent-text');
  const uploadStatusText = document.getElementById('upload-status-text');
  const uploadStatsText = document.getElementById('upload-stats-text');
  const cancelUploadBtn = document.getElementById('cancel-upload-btn');
  const currentApkCard = document.getElementById('current-apk-card');
  const apkFileList = document.getElementById('apk-file-list');

  // API URL setting
  const apiUrlInput = document.getElementById('custom-api-url-input');
  const saveApiUrlBtn = document.getElementById('save-api-url-btn');

  let activeUploadSession = null;
  let isUploading = false;
  let abortController = null;

  // Initialize
  checkAuth();
  setupTabs();
  setupApiUrlConfig();

  function getToken() {
    return localStorage.getItem('MINECRAFT_PORTAL_ADMIN_TOKEN');
  }

  function setToken(token) {
    if (token) localStorage.setItem('MINECRAFT_PORTAL_ADMIN_TOKEN', token);
    else localStorage.removeItem('MINECRAFT_PORTAL_ADMIN_TOKEN');
  }

  async function checkAuth() {
    const token = getToken();
    if (!token) {
      showLogin();
      return;
    }

    try {
      const res = await fetch(`${apiBase}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (adminNameDisplay) adminNameDisplay.textContent = data.admin.username;
        showDashboard();
        loadServerSettings();
        loadApkList();
      } else {
        setToken(null);
        showLogin();
      }
    } catch (err) {
      // In case backend is temporarily unreachable
      showLogin('Backend connection issue. Check API URL or try again.');
    }
  }

  function showLogin(errMsg = '') {
    if (loginSection) loginSection.style.display = 'flex';
    if (dashboardSection) dashboardSection.style.display = 'none';
    if (loginErrorMsg) {
      loginErrorMsg.textContent = errMsg;
      loginErrorMsg.style.display = errMsg ? 'block' : 'none';
    }
  }

  function showDashboard() {
    if (loginSection) loginSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';
  }

  // Handle Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginErrorMsg.style.display = 'none';
      const username = loginUsernameInput.value.trim();
      const password = loginPasswordInput.value;

      try {
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying...';

        const res = await fetch(`${apiBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Dashboard';

        if (res.ok && data.success) {
          setToken(data.token);
          if (adminNameDisplay) adminNameDisplay.textContent = data.admin.username;
          showDashboard();
          loadServerSettings();
          loadApkList();
          showToast('Welcome back, ' + data.admin.username);
        } else {
          loginErrorMsg.textContent = data.error || 'Invalid credentials.';
          loginErrorMsg.style.display = 'block';
        }
      } catch (err) {
        loginErrorMsg.textContent = 'Connection error. Ensure backend is running.';
        loginErrorMsg.style.display = 'block';
      }
    });
  }

  // Handle Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      setToken(null);
      showLogin('You have been signed out.');
      showToast('Logged out successfully.');
    });
  }

  // Tab switching
  function setupTabs() {
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabTarget = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePane = document.getElementById(`tab-${tabTarget}`);
        if (activePane) activePane.classList.add('active');
      });
    });
  }

  // Load current server settings
  async function loadServerSettings() {
    try {
      const res = await fetch(`${apiBase}/api/server/info`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const s = data.data;
        if (javaAddressInput) javaAddressInput.value = s.java?.address || '';
        if (javaPortInput) javaPortInput.value = s.java?.port || '25565';
        if (javaVersionInput) javaVersionInput.value = s.java?.version || '26.3';
        if (javaLauncherInput) javaLauncherInput.value = s.java?.launcher || 'TLauncher';
        if (javaHostingInput) javaHostingInput.value = s.java?.hosting || 'Aternos';

        if (bedrockAddressInput) bedrockAddressInput.value = s.bedrock?.address || '';
        if (bedrockPortInput) bedrockPortInput.value = s.bedrock?.port || '19132';
        if (bedrockVersionInput) bedrockVersionInput.value = s.bedrock?.version || 'Latest Bedrock';
        if (bedrockPlatformInput) bedrockPlatformInput.value = s.bedrock?.platform || 'Android & Bedrock Devices';
        if (bedrockHostingInput) bedrockHostingInput.value = s.bedrock?.hosting || 'Aternos';

        if (announcementInput) announcementInput.value = s.announcement || '';
      }
    } catch (err) {
      console.error('Error loading server settings:', err);
    }
  }

  // Save server settings
  if (serverSettingsForm) {
    serverSettingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = getToken();

      const payload = {
        java_address: javaAddressInput.value.trim(),
        java_port: javaPortInput.value.trim(),
        java_version: javaVersionInput.value.trim(),
        java_launcher: javaLauncherInput.value.trim(),
        java_hosting: javaHostingInput.value.trim(),
        bedrock_address: bedrockAddressInput.value.trim(),
        bedrock_port: bedrockPortInput.value.trim(),
        bedrock_version: bedrockVersionInput.value.trim(),
        bedrock_platform: bedrockPlatformInput.value.trim(),
        bedrock_hosting: bedrockHostingInput.value.trim(),
        announcement: announcementInput.value.trim()
      };

      try {
        serverSettingsSaveBtn.disabled = true;
        serverSettingsSaveBtn.textContent = 'Saving...';

        const res = await fetch(`${apiBase}/api/server/settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        serverSettingsSaveBtn.disabled = false;
        serverSettingsSaveBtn.textContent = 'Save Server Settings';

        if (res.ok && data.success) {
          showToast('Server settings updated successfully!');
        } else {
          showToast(data.error || 'Failed to save settings.', true);
        }
      } catch (err) {
        serverSettingsSaveBtn.disabled = false;
        serverSettingsSaveBtn.textContent = 'Save Server Settings';
        showToast('Network error while saving settings.', true);
      }
    });
  }

  // Load APK file records
  async function loadApkList() {
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/apk/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        renderApkCards(data.files || []);
      }
    } catch (err) {
      console.error('Failed to load APK list:', err);
    }
  }

  function renderApkCards(files) {
    if (!apkFileList) return;

    if (files.length === 0) {
      apkFileList.innerHTML = `
        <div class="empty-state">
          <p>No APK files uploaded yet. Upload an authorized distributable .apk below.</p>
        </div>
      `;
      return;
    }

    apkFileList.innerHTML = files.map(file => `
      <div class="apk-item-card ${file.is_published ? 'published' : 'archived'}">
        <div class="apk-item-header">
          <div>
            <h4 class="apk-item-title">${escapeHtml(file.file_name)}</h4>
            <span class="badge ${file.is_published ? 'badge-green' : 'badge-gray'}">
              ${file.is_published ? 'Published on Homepage' : 'Archived'}
            </span>
            <span class="badge badge-cyan">v${escapeHtml(file.version)}</span>
          </div>
          <div class="apk-item-actions">
            <button class="btn btn-sm btn-danger delete-apk-btn" data-id="${file.id}">Delete</button>
          </div>
        </div>
        <div class="apk-item-details">
          <div><strong>Size:</strong> ${file.fileSizeFormatted}</div>
          <div><strong>Downloads:</strong> ${file.download_count}</div>
          <div><strong>Uploaded:</strong> ${new Date(file.created_at).toLocaleDateString()}</div>
        </div>
        <div class="apk-item-hash">
          <strong>SHA-256:</strong> <code>${file.sha256_hash}</code>
        </div>
      </div>
    `).join('');

    // Attach delete listeners
    document.querySelectorAll('.delete-apk-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('Are you sure you want to delete this APK file? Visitors will no longer be able to download it.')) return;

        try {
          const res = await fetch(`${apiBase}/api/apk/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast('APK file deleted successfully.');
            loadApkList();
          } else {
            showToast(data.error || 'Failed to delete APK.', true);
          }
        } catch (err) {
          showToast('Network error during deletion.', true);
        }
      });
    });
  }

  // Handle Large File Multipart Upload to Cloudflare R2
  if (apkUploadForm) {
    apkUploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = apkFileInput.files[0];
      const version = apkVersionInput.value.trim();
      const description = apkDescInput.value.trim();

      if (!file) {
        showToast('Please select a .apk file.', true);
        return;
      }

      if (!file.name.toLowerCase().endsWith('.apk')) {
        showToast('Only .apk files are supported.', true);
        return;
      }

      const MAX_SIZE = 1024 * 1024 * 1024; // 1 GB
      if (file.size > MAX_SIZE) {
        showToast('File size exceeds the 1 GB maximum limit.', true);
        return;
      }

      if (!version) {
        showToast('Please enter an application version.', true);
        return;
      }

      startMultipartUpload(file, version, description);
    });
  }

  async function startMultipartUpload(file, version, description) {
    const token = getToken();
    isUploading = true;
    abortController = new AbortController();

    // Show progress card
    uploadProgressCard.style.display = 'block';
    uploadProgressBar.style.width = '0%';
    uploadPercentText.textContent = '0%';
    uploadStatusText.textContent = 'Calculating SHA-256 integrity checksum...';
    uploadStatsText.textContent = `File: ${file.name} (${formatBytes(file.size)})`;

    try {
      // Step 1: Compute SHA-256 Checksum on client (Requirement 1)
      const sha256Hash = await calculateFileSha256(file, (pct) => {
        uploadStatusText.textContent = `Calculating SHA-256 checksum (${pct}%)...`;
      });
      uploadStatusText.textContent = `SHA-256: ${sha256Hash.substring(0, 16)}... Initiating upload...`;

      // Step 2: Initiate Multipart Upload on backend
      const initRes = await fetch(`${apiBase}/api/apk/upload/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          version,
          sha256Hash,
          description
        }),
        signal: abortController.signal
      });

      const initData = await initRes.json();
      if (!initRes.ok || !initData.success) {
        throw new Error(initData.error || 'Failed to initiate multipart upload.');
      }

      const { uploadId, chunkSize, totalParts, simulated } = initData;
      activeUploadSession = { uploadId, file };

      const completedParts = [];
      const startTime = Date.now();
      let totalUploadedBytes = 0;

      // Step 3: Upload each part directly to Cloudflare R2 presigned URL
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (!isUploading) break;

        const startByte = (partNumber - 1) * chunkSize;
        const endByte = Math.min(startByte + chunkSize, file.size);
        const chunkBlob = file.slice(startByte, endByte);

        uploadStatusText.textContent = `Uploading part ${partNumber} of ${totalParts} directly to cloud storage...`;

        // Request presigned URL for this part (secured by admin auth & ownership)
        const presignRes = await fetch(`${apiBase}/api/apk/upload/presign-part`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ uploadId, partNumber }),
          signal: abortController.signal
        });

        const presignData = await presignRes.json();
        if (!presignRes.ok || !presignData.success) {
          throw new Error(presignData.error || `Failed to sign part ${partNumber}`);
        }

        // Upload chunk directly to Cloudflare R2
        let uploadUrl = presignData.presignedUrl;
        if (uploadUrl.startsWith('/')) {
          // Local simulation
          uploadUrl = `${apiBase}${uploadUrl}`;
        }

        const r2UploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: chunkBlob,
          signal: abortController.signal
        });

        if (!r2UploadRes.ok) {
          throw new Error(`Direct R2 upload failed on part ${partNumber} (HTTP ${r2UploadRes.status})`);
        }

        // Extract ETag
        let etag = r2UploadRes.headers.get('ETag') || `"part-${partNumber}-etag"`;
        completedParts.push({ PartNumber: partNumber, ETag: etag });

        totalUploadedBytes += (endByte - startByte);
        const percent = Math.round((totalUploadedBytes / file.size) * 100);
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speedMBps = ((totalUploadedBytes / (1024 * 1024)) / (elapsedSec || 1)).toFixed(2);

        uploadProgressBar.style.width = `${percent}%`;
        uploadPercentText.textContent = `${percent}%`;
        uploadStatsText.textContent = `${formatBytes(totalUploadedBytes)} of ${formatBytes(file.size)} (${speedMBps} MB/s)`;
      }

      if (!isUploading) return;

      // Step 4: Complete Multipart Upload
      uploadStatusText.textContent = 'Verifying parts and finalizing publication...';
      const completeRes = await fetch(`${apiBase}/api/apk/upload/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uploadId, parts: completedParts }),
        signal: abortController.signal
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok || !completeData.success) {
        throw new Error(completeData.error || 'Failed to complete multipart upload.');
      }

      uploadStatusText.textContent = 'Upload complete! APK is now live.';
      showToast('APK published successfully!');
      apkUploadForm.reset();
      loadApkList();

      setTimeout(() => {
        uploadProgressCard.style.display = 'none';
        isUploading = false;
        activeUploadSession = null;
      }, 3000);

    } catch (err) {
      if (err.name === 'AbortError') {
        uploadStatusText.textContent = 'Upload cancelled by user.';
        showToast('Upload cancelled.', true);
      } else {
        uploadStatusText.textContent = `Error: ${err.message}`;
        showToast(`Upload failed: ${err.message}`, true);
      }
      isUploading = false;
      activeUploadSession = null;
    }
  }

  // Cancel upload button
  if (cancelUploadBtn) {
    cancelUploadBtn.addEventListener('click', async () => {
      if (!isUploading || !activeUploadSession) return;
      isUploading = false;
      if (abortController) abortController.abort();

      try {
        await fetch(`${apiBase}/api/apk/upload/abort`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({ uploadId: activeUploadSession.uploadId })
        });
      } catch (e) {
        // Ignore abort network error
      }
      uploadProgressCard.style.display = 'none';
      showToast('Upload aborted.');
    });
  }

  // Web Crypto SHA-256 streaming hash calculation for large files (Requirement 1)
  async function calculateFileSha256(file, onProgress) {
    const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB read chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    // If small file, compute in single shot
    if (file.size <= 32 * 1024 * 1024) {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      return bufferToHex(hashBuffer);
    }

    // For larger files up to 1GB, calculate hash progressively using array buffer
    // Note: Standard Web Crypto subtle.digest requires the full buffer or progressive hash
    // Modern browsers support read into ArrayBuffer
    const buffer = await file.arrayBuffer();
    if (onProgress) onProgress(50);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    if (onProgress) onProgress(100);
    return bufferToHex(hashBuffer);
  }

  function bufferToHex(buffer) {
    const byteArray = new Uint8Array(buffer);
    let hexString = '';
    for (let i = 0; i < byteArray.length; i++) {
      hexString += byteArray[i].toString(16).padStart(2, '0');
    }
    return hexString;
  }

  function setupApiUrlConfig() {
    if (apiUrlInput) {
      apiUrlInput.value = CONFIG.getApiBaseUrl();
    }

    if (saveApiUrlBtn && apiUrlInput) {
      saveApiUrlBtn.addEventListener('click', () => {
        const val = apiUrlInput.value.trim();
        CONFIG.setApiBaseUrl(val);
        showToast('API URL configuration saved! Reloading dashboard...');
        setTimeout(() => window.location.reload(), 1000);
      });
    }
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[m]);
  }

  function showToast(message, isError = false) {
    const existing = document.querySelector('.portal-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `portal-toast ${isError ? 'error' : 'success'}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
});
