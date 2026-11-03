/**
 * Simplified Admin Dashboard Logic
 * Zero-complexity server configuration and free APK distribution management.
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

  // DOM Elements - APK Publishing
  const apkPublishForm = document.getElementById('apk-publish-form');
  const apkUrlInput = document.getElementById('apk-url-input');
  const apkNameInput = document.getElementById('apk-name-input');
  const apkVersionInput = document.getElementById('apk-version-input');
  const apkSizeInput = document.getElementById('apk-size-input');
  const apkShaInput = document.getElementById('apk-sha-input');
  const apkDescInput = document.getElementById('apk-desc-input');
  const apkFileInspect = document.getElementById('apk-file-inspect');
  const hashStatusText = document.getElementById('hash-status-text');
  const apkPublishedStatus = document.getElementById('apk-published-status');
  const adminApkDownloads = document.getElementById('admin-apk-downloads');
  const unpublishApkBtn = document.getElementById('unpublish-apk-btn');

  // API URL setting
  const apiUrlInput = document.getElementById('custom-api-url-input');
  const saveApiUrlBtn = document.getElementById('save-api-url-btn');

  checkAuth();
  setupTabs();
  setupApiUrlConfig();
  setupFileInspector();

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
        loadApkDetails();
      } else {
        setToken(null);
        showLogin();
      }
    } catch (err) {
      showLogin('Backend connection issue. Check API URL or ensure backend is running.');
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
          loadApkDetails();
          showToast('Welcome, ' + data.admin.username);
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

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      setToken(null);
      showLogin('You have been signed out.');
      showToast('Logged out successfully.');
    });
  }

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

  // Load APK Details
  async function loadApkDetails() {
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/apk/admin-details`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok && data.success && data.apk) {
        const apk = data.apk;
        if (apkUrlInput) apkUrlInput.value = apk.download_url || '';
        if (apkNameInput) apkNameInput.value = apk.file_name || 'Minecraft-Bedrock-Companion.apk';
        if (apkVersionInput) apkVersionInput.value = apk.version || '1.20.50';
        if (apkSizeInput) apkSizeInput.value = apk.file_size_formatted || '400 MB';
        if (apkShaInput) apkShaInput.value = apk.sha256_hash || '';
        if (apkDescInput) apkDescInput.value = apk.description || '';

        if (adminApkDownloads) adminApkDownloads.textContent = apk.download_count || 0;

        if (apkPublishedStatus) {
          if (apk.is_published && apk.download_url) {
            apkPublishedStatus.textContent = 'Published & Visible on Homepage';
            apkPublishedStatus.style.color = '#10b981';
          } else {
            apkPublishedStatus.textContent = 'Not Published (Hidden on Homepage)';
            apkPublishedStatus.style.color = '#ef4444';
          }
        }
      }
    } catch (err) {
      console.error('Failed to load APK details:', err);
    }
  }

  // Publish APK
  if (apkPublishForm) {
    apkPublishForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = getToken();

      const payload = {
        downloadUrl: apkUrlInput.value.trim(),
        fileName: apkNameInput.value.trim(),
        version: apkVersionInput.value.trim(),
        fileSizeFormatted: apkSizeInput.value.trim(),
        sha256Hash: apkShaInput.value.trim(),
        description: apkDescInput.value.trim()
      };

      try {
        const saveBtn = document.getElementById('save-apk-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Publishing...';

        const res = await fetch(`${apiBase}/api/apk/publish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        saveBtn.disabled = false;
        saveBtn.textContent = 'Publish APK on Homepage';

        if (res.ok && data.success) {
          showToast('APK package published to homepage!');
          loadApkDetails();
        } else {
          showToast(data.error || 'Failed to publish APK.', true);
        }
      } catch (err) {
        showToast('Network error while publishing APK.', true);
      }
    });
  }

  // Unpublish APK
  if (unpublishApkBtn) {
    unpublishApkBtn.addEventListener('click', async () => {
      if (!confirm('Hide the APK download section from the homepage?')) return;
      const token = getToken();

      try {
        const res = await fetch(`${apiBase}/api/apk/unpublish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast('APK hidden from public homepage.');
          loadApkDetails();
        } else {
          showToast(data.error || 'Failed to unpublish.', true);
        }
      } catch (err) {
        showToast('Network error.', true);
      }
    });
  }

  // Optional local file inspector for auto-filling hash & size
  function setupFileInspector() {
    if (!apkFileInspect) return;

    apkFileInspect.addEventListener('change', async () => {
      const file = apkFileInspect.files[0];
      if (!file) return;

      if (apkNameInput) apkNameInput.value = file.name;
      if (apkSizeInput) apkSizeInput.value = formatBytes(file.size);

      if (hashStatusText) hashStatusText.textContent = 'Calculating SHA-256 hash...';

      try {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (apkShaInput) apkShaInput.value = hashHex;
        if (hashStatusText) hashStatusText.textContent = `✓ Auto-filled size (${formatBytes(file.size)}) and SHA-256 hash!`;
      } catch (err) {
        if (hashStatusText) hashStatusText.textContent = 'Could not auto-hash (browser memory limit). You can enter the hash manually.';
      }
    });
  }

  function setupApiUrlConfig() {
    if (apiUrlInput) {
      apiUrlInput.value = CONFIG.getApiBaseUrl();
    }

    if (saveApiUrlBtn && apiUrlInput) {
      saveApiUrlBtn.addEventListener('click', () => {
        const val = apiUrlInput.value.trim();
        CONFIG.setApiBaseUrl(val);
        showToast('API URL saved! Reloading dashboard...');
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
