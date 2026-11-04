/**
 * Main Frontend Application Logic
 * Non-blocking, resilient against sleeping backends, and fully responsive.
 */
document.addEventListener('DOMContentLoaded', () => {
  const apiBase = CONFIG.getApiBaseUrl();

  // Elements
  const apiStatusPill = document.getElementById('api-status-pill');
  const apiStatusDot = document.getElementById('api-status-dot');
  const apiStatusText = document.getElementById('api-status-text');

  // Java Elements
  const javaAddressEl = document.getElementById('java-address');
  const javaPortEl = document.getElementById('java-port');
  const javaVersionEl = document.getElementById('java-version');
  const javaLauncherEl = document.getElementById('java-launcher');
  const javaHostingEl = document.getElementById('java-hosting');
  const copyJavaBtn = document.getElementById('copy-java-btn');

  // Bedrock Elements
  const bedrockAddressEl = document.getElementById('bedrock-address');
  const bedrockPortEl = document.getElementById('bedrock-port');
  const bedrockVersionEl = document.getElementById('bedrock-version');
  const bedrockPlatformEl = document.getElementById('bedrock-platform');
  const bedrockHostingEl = document.getElementById('bedrock-hosting');
  const copyBedrockAddressBtn = document.getElementById('copy-bedrock-address-btn');
  const copyBedrockPortBtn = document.getElementById('copy-bedrock-port-btn');

  // APK Elements
  const apkSection = document.getElementById('apk-section');
  const apkVersionEl = document.getElementById('apk-version');
  const apkSizeEl = document.getElementById('apk-size');
  const apkShaEl = document.getElementById('apk-sha256');
  const apkDescEl = document.getElementById('apk-description');
  const apkDownloadsEl = document.getElementById('apk-downloads');
  const apkDownloadBtn = document.getElementById('apk-download-btn');
  const copyShaBtn = document.getElementById('copy-sha-btn');

  // Community announcement
  const announcementBanner = document.getElementById('announcement-banner');
  const announcementText = document.getElementById('announcement-text');

  let pollInterval = null;
  let retryCount = 0;

  // Default fallback data for instant load before backend wakes up
  const FALLBACK_SERVER = {
    java: {
      address: 'stevenalex.aternos.me',
      port: '25565',
      version: '26.3',
      launcher: 'TLauncher',
      hosting: 'Aternos'
    },
    bedrock: {
      address: 'stevenalex.aternos.me',
      port: '19132',
      version: 'Latest Bedrock (v26.5)',
      platform: 'Android & Bedrock Devices',
      hosting: 'Aternos'
    },
    discord_url: 'https://discord.gg/PYWfWeWYB3',
    announcement: 'Welcome to our Minecraft Community Server! Connection details are configured in the Admin Panel.'
  };

  const FALLBACK_APK = {
    fileName: 'minecraft-26-50.apk',
    fileSizeFormatted: '346.2 MB',
    version: '26.5',
    sha256Hash: '7b1ef882ecfec9c41155488e38f69654b95559ab69836d15573cfe2d29232039',
    description: 'Official community companion application with one-click server connection.',
    downloadCount: 'Verified'
  };

  // 1. Immediately hydrate UI from localStorage or verified defaults (instant 0s load!)
  hydrateInitialUI();

  // Initialize clipboard listeners
  setupClipboard();

  // 2. Fetch live updates in background without blocking
  fetchServerData();
  fetchApkData();

  function hydrateInitialUI() {
    let cachedServer = null;
    let cachedApk = null;

    try {
      const s = localStorage.getItem('MINECRAFT_PORTAL_CACHED_SERVER');
      if (s) cachedServer = JSON.parse(s);
    } catch (_) {}

    try {
      const a = localStorage.getItem('MINECRAFT_PORTAL_CACHED_APK');
      if (a) cachedApk = JSON.parse(a);
    } catch (_) {}

    populateServerData(cachedServer || FALLBACK_SERVER);
    populateApkSection(cachedApk || FALLBACK_APK);
  }

  function updateStatus(state, message) {
    if (!apiStatusPill || !apiStatusDot || !apiStatusText) return;

    apiStatusDot.className = 'status-dot';
    if (state === 'online') {
      apiStatusDot.classList.add('online');
      apiStatusText.textContent = message || 'Portal Connected';
    } else if (state === 'waking') {
      apiStatusDot.classList.add('warning');
      apiStatusText.textContent = message || 'Server waking up (~15s)...';
    } else if (state === 'offline') {
      apiStatusDot.classList.add('offline');
      apiStatusText.textContent = message || 'Portal Offline';
    }
  }

  async function fetchServerData() {
    updateStatus('waking', 'Server waking up (~15s)...');
    try {
      const response = await fetch(`${apiBase}/api/server/info`, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error(`HTTP error ${response.status}`);

      const result = await response.json();
      if (result.success && result.data) {
        populateServerData(result.data);
        try {
          localStorage.setItem('MINECRAFT_PORTAL_CACHED_SERVER', JSON.stringify(result.data));
        } catch (_) {}
        updateStatus('online', 'Server Portal Online');
        clearInterval(pollInterval);
      }
    } catch (err) {
      retryCount++;
      if (retryCount <= 12) {
        updateStatus('waking', `Server waking up (${retryCount * 5}s)...`);
        if (!pollInterval) {
          pollInterval = setInterval(fetchServerData, 5000);
        }
      } else {
        updateStatus('warning', 'Cached server info');
      }
    }
  }

  function populateServerData(data) {
    if (!data) return;

    if (data.java) {
      if (javaAddressEl) {
        javaAddressEl.textContent = data.java.address || 'stevenalex.aternos.me';
        javaAddressEl.classList.remove('unconfigured');
      }
      if (javaPortEl) javaPortEl.textContent = data.java.port || '25565';
      if (javaVersionEl) javaVersionEl.textContent = data.java.version || '26.3';
      if (javaLauncherEl) javaLauncherEl.textContent = data.java.launcher || 'TLauncher';
      if (javaHostingEl) javaHostingEl.textContent = data.java.hosting || 'Aternos';
    }

    if (data.bedrock) {
      if (bedrockAddressEl) {
        bedrockAddressEl.textContent = data.bedrock.address || 'stevenalex.aternos.me';
        bedrockAddressEl.classList.remove('unconfigured');
      }
      if (bedrockPortEl) bedrockPortEl.textContent = data.bedrock.port || '19132';
      if (bedrockVersionEl) bedrockVersionEl.textContent = data.bedrock.version || 'Latest Bedrock (v26.5)';
      if (bedrockPlatformEl) bedrockPlatformEl.textContent = data.bedrock.platform || 'Android & Bedrock Devices';
      if (bedrockHostingEl) bedrockHostingEl.textContent = data.bedrock.hosting || 'Aternos';
    }

    if (data.announcement && announcementBanner && announcementText) {
      announcementText.textContent = data.announcement;
      announcementBanner.style.display = 'flex';
    }

    // Discord button
    const discordBtn = document.getElementById('discord-hero-btn');
    if (discordBtn) {
      const url = (data.discord_url || 'https://discord.gg/PYWfWeWYB3').trim();
      if (url) {
        discordBtn.href = url;
        discordBtn.style.display = 'inline-flex';
      }
    }
  }

  async function fetchApkData() {
    try {
      const response = await fetch(`${apiBase}/api/apk/info`);
      if (!response.ok) return;

      const result = await response.json();
      if (result.success && result.available && result.apk) {
        populateApkSection(result.apk);
        try {
          localStorage.setItem('MINECRAFT_PORTAL_CACHED_APK', JSON.stringify(result.apk));
        } catch (_) {}
      }
    } catch (err) {
      // Backend is asleep or cold-starting: keep the cached APK visible!
      console.log('[PORTAL] Backend warming up, keeping cached APK details visible.');
    }
  }

  function populateApkSection(apk) {
    if (!apkSection || !apk) return;
    apkSection.style.display = 'block';

    if (apkVersionEl && apk.version) apkVersionEl.textContent = `v${apk.version}`;
    if (apkSizeEl && (apk.fileSizeFormatted || apk.fileSize)) {
      apkSizeEl.textContent = apk.fileSizeFormatted || `${(apk.fileSize / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (apkDescEl && apk.description) apkDescEl.textContent = apk.description;
    if (apkDownloadsEl) {
      apkDownloadsEl.textContent = apk.downloadCount ? `${apk.downloadCount} downloads` : 'Verified';
    }

    // Direct 1-click download link
    if (apkDownloadBtn) {
      apkDownloadBtn.href = `${apiBase}/api/apk/download?redirect=true`;
      apkDownloadBtn.target = '_blank';
      apkDownloadBtn.rel = 'noopener noreferrer';
      apkDownloadBtn.onclick = () => {
        showToast('Download started directly!');
      };
    }

    // Optional SHA-256 hash
    const hashDetails = document.getElementById('apk-hash-details');
    const hash = apk.sha256Hash || apk.sha256_hash;
    if (apkShaEl && hash) {
      apkShaEl.textContent = hash;
      if (hashDetails) hashDetails.style.display = 'block';
    }
  }

  function setupClipboard() {
    // Copy Java Address
    if (copyJavaBtn && javaAddressEl) {
      copyJavaBtn.addEventListener('click', () => {
        const text = javaAddressEl.textContent.trim();
        if (text && !text.includes('pending')) {
          copyToClipboard(text, copyJavaBtn);
        } else {
          showToast('Java server address has not been configured yet.', true);
        }
      });
    }

    // Copy Bedrock Address
    if (copyBedrockAddressBtn && bedrockAddressEl) {
      copyBedrockAddressBtn.addEventListener('click', () => {
        const text = bedrockAddressEl.textContent.trim();
        if (text && !text.includes('pending')) {
          copyToClipboard(text, copyBedrockAddressBtn);
        } else {
          showToast('Bedrock server address has not been configured yet.', true);
        }
      });
    }

    // Copy Bedrock Port
    if (copyBedrockPortBtn && bedrockPortEl) {
      copyBedrockPortBtn.addEventListener('click', () => {
        const text = bedrockPortEl.textContent.trim();
        copyToClipboard(text, copyBedrockPortBtn);
      });
    }

    // Copy SHA-256 Checksum
    if (copyShaBtn && apkShaEl) {
      copyShaBtn.addEventListener('click', () => {
        const text = apkShaEl.textContent.trim();
        copyToClipboard(text, copyShaBtn);
      });
    }
  }

  function copyToClipboard(text, triggerBtn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        triggerSuccess(triggerBtn);
      }).catch(() => fallbackCopy(text, triggerBtn));
    } else {
      fallbackCopy(text, triggerBtn);
    }
  }

  function fallbackCopy(text, triggerBtn) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      triggerSuccess(triggerBtn);
    } catch (err) {
      showToast('Could not copy automatically.', true);
    }
    document.body.removeChild(textarea);
  }

  function triggerSuccess(button) {
    if (!button) return;
    const originalText = button.innerHTML;
    button.classList.add('copied');
    button.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Copied!
    `;
    setTimeout(() => {
      button.classList.remove('copied');
      button.innerHTML = originalText;
    }, 2000);
  }

  function setupAccessRequestForm() {
    const form = document.getElementById('access-request-form');
    const userInput = document.getElementById('req-aternos-user');
    const ignInput = document.getElementById('req-mc-ign');
    const submitBtn = document.getElementById('submit-access-btn');
    const feedback = document.getElementById('access-form-feedback');

    if (!form || !userInput) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const aternosUsername = userInput.value.trim();
      const minecraftIgn = ignInput ? ignInput.value.trim() : '';

      // Anti-phishing check on client
      const urlPattern = /(https?:\/\/|www\.|\.com|\.net|\.org|\.ru|\.gg|\.me|\.xyz|\/|\\|@)/i;
      if (urlPattern.test(aternosUsername) || urlPattern.test(minecraftIgn)) {
        if (feedback) {
          feedback.style.display = 'block';
          feedback.style.background = 'rgba(239, 68, 68, 0.15)';
          feedback.style.border = '1px solid rgba(239, 68, 68, 0.4)';
          feedback.style.color = '#fca5a5';
          feedback.textContent = 'Security Notice: Links and URLs are not permitted. Please enter your username only.';
        }
        showToast('Links are strictly forbidden.', true);
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting...';
        }

        const res = await fetch(`${apiBase}/api/server/access-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            aternos_username: aternosUsername,
            minecraft_ign: minecraftIgn
          })
        });

        const data = await res.json();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Request Server Access
          `;
        }

        if (res.ok && data.success) {
          if (feedback) {
            feedback.style.display = 'block';
            feedback.style.background = 'rgba(16, 185, 129, 0.15)';
            feedback.style.border = '1px solid rgba(16, 185, 129, 0.4)';
            feedback.style.color = '#34d399';
            feedback.textContent = `✓ Access requested for Aternos user "${aternosUsername}"! An administrator will add your account.`;
          }
          form.reset();
          showToast('Aternos username submitted successfully!');
        } else {
          if (feedback) {
            feedback.style.display = 'block';
            feedback.style.background = 'rgba(239, 68, 68, 0.15)';
            feedback.style.border = '1px solid rgba(239, 68, 68, 0.4)';
            feedback.style.color = '#fca5a5';
            feedback.textContent = data.error || 'Failed to submit request.';
          }
          showToast(data.error || 'Submission failed', true);
        }
      } catch (err) {
        if (submitBtn) submitBtn.disabled = false;
        showToast('Network error while submitting request.', true);
      }
    });
  }

  setupAccessRequestForm();
});
