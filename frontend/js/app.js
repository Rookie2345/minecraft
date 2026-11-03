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

  // Initialize clipboard listeners
  setupClipboard();

  // Fetch data asynchronously without blocking the UI
  fetchServerData();
  fetchApkData();

  function updateStatus(state, message) {
    if (!apiStatusPill || !apiStatusDot || !apiStatusText) return;

    apiStatusDot.className = 'status-dot';
    if (state === 'online') {
      apiStatusDot.classList.add('online');
      apiStatusText.textContent = message || 'Portal Connected';
    } else if (state === 'waking') {
      apiStatusDot.classList.add('warning');
      apiStatusText.textContent = message || 'Backend waking up...';
    } else if (state === 'offline') {
      apiStatusDot.classList.add('offline');
      apiStatusText.textContent = message || 'Portal Offline';
    }
  }

  async function fetchServerData() {
    updateStatus('waking', 'Checking network...');
    try {
      const response = await fetch(`${apiBase}/api/server/info`, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error(`HTTP error ${response.status}`);

      const result = await response.json();
      if (result.success && result.data) {
        populateServerData(result.data);
        updateStatus('online', 'Server Portal Online');
        clearInterval(pollInterval);
      }
    } catch (err) {
      retryCount++;
      if (retryCount <= 10) {
        updateStatus('waking', `Connecting (${retryCount * 5}s)...`);
        if (!pollInterval) {
          pollInterval = setInterval(fetchServerData, 6000);
        }
      } else {
        updateStatus('offline', 'Using cached info');
      }
    }
  }

  function populateServerData(data) {
    if (data.java) {
      if (javaAddressEl) {
        javaAddressEl.textContent = data.java.address || 'Address pending in admin';
        if (!data.java.address) javaAddressEl.classList.add('unconfigured');
        else javaAddressEl.classList.remove('unconfigured');
      }
      if (javaPortEl) javaPortEl.textContent = data.java.port || '25565';
      if (javaVersionEl) javaVersionEl.textContent = data.java.version || '26.3';
      if (javaLauncherEl) javaLauncherEl.textContent = data.java.launcher || 'TLauncher';
      if (javaHostingEl) javaHostingEl.textContent = data.java.hosting || 'Aternos';
    }

    if (data.bedrock) {
      if (bedrockAddressEl) {
        bedrockAddressEl.textContent = data.bedrock.address || 'Address pending in admin';
        if (!data.bedrock.address) bedrockAddressEl.classList.add('unconfigured');
        else bedrockAddressEl.classList.remove('unconfigured');
      }
      if (bedrockPortEl) bedrockPortEl.textContent = data.bedrock.port || '19132';
      if (bedrockVersionEl) bedrockVersionEl.textContent = data.bedrock.version || 'Latest Bedrock';
      if (bedrockPlatformEl) bedrockPlatformEl.textContent = data.bedrock.platform || 'Android & Bedrock';
      if (bedrockHostingEl) bedrockHostingEl.textContent = data.bedrock.hosting || 'Aternos';
    }

    if (data.announcement && announcementBanner && announcementText) {
      announcementText.textContent = data.announcement;
      announcementBanner.style.display = 'flex';
    }

    // Show/hide Discord button based on configured URL
    const discordBtn = document.getElementById('discord-hero-btn');
    if (discordBtn) {
      if (data.discord_url && data.discord_url.trim()) {
        discordBtn.href = data.discord_url.trim();
        discordBtn.style.display = 'inline-flex';
      } else {
        discordBtn.style.display = 'none';
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
      } else {
        // Section is only shown when an administrator has uploaded an authorized file
        if (apkSection) apkSection.style.display = 'none';
      }
    } catch (err) {
      // Backend asleep or offline: keep APK section hidden safely
      if (apkSection) apkSection.style.display = 'none';
    }
  }

  function populateApkSection(apk) {
    if (!apkSection) return;
    apkSection.style.display = 'block';

    if (apkVersionEl) apkVersionEl.textContent = `v${apk.version}`;
    if (apkSizeEl) apkSizeEl.textContent = apk.fileSizeFormatted || `${(apk.fileSize / (1024 * 1024)).toFixed(1)} MB`;
    if (apkDescEl) apkDescEl.textContent = apk.description || 'Official community-authorized companion client.';
    if (apkDownloadsEl) apkDownloadsEl.textContent = `${apk.downloadCount} downloads`;

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
    if (apkShaEl && apk.sha256Hash) {
      apkShaEl.textContent = apk.sha256Hash;
      if (hashDetails) hashDetails.style.display = 'block';
    } else if (hashDetails) {
      hashDetails.style.display = 'none';
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
