const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'portal-data.json');

// Default initial state
const defaultData = {
  admins: [],
  server_settings: {
    java_address: '',
    java_port: '25565',
    java_version: '26.3',
    java_launcher: 'TLauncher',
    java_hosting: 'Aternos',
    bedrock_address: '',
    bedrock_port: '19132',
    bedrock_version: 'Latest Bedrock (v1.20+)',
    bedrock_platform: 'Android & Bedrock Devices',
    bedrock_hosting: 'Aternos',
    announcement: 'Welcome to our Minecraft Community Server! Configure connection details in the Admin Panel.',
    updated_at: new Date().toISOString()
  },
  apk: {
    is_published: false,
    file_name: 'Minecraft-Companion.apk',
    download_url: '',
    file_size_formatted: '400 MB',
    version: '1.20.50',
    sha256_hash: '',
    description: 'Official community companion application with one-click server connection.',
    download_count: 0,
    updated_at: new Date().toISOString()
  }
};

let memoryStore = { ...defaultData };

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      memoryStore = JSON.parse(raw);
    } else {
      saveData();
    }
  } catch (err) {
    console.warn('[STORAGE] Using in-memory fallback:', err.message);
  }
}

function saveData() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (err) {
    console.error('[STORAGE] Error writing data file:', err.message);
  }
}

async function initDB() {
  loadData();

  // Seed initial admin if empty
  if (!memoryStore.admins || memoryStore.admins.length === 0) {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    memoryStore.admins = [
      {
        id: 1,
        username: adminUsername,
        password_hash: passwordHash,
        created_at: new Date().toISOString()
      }
    ];
    saveData();
    console.log(`[STORAGE] Administrator account initialized: "${adminUsername}".`);
  } else {
    console.log(`[STORAGE] Loaded existing administrator accounts (${memoryStore.admins.length}).`);
  }
}

function getSettings() {
  return memoryStore.server_settings;
}

function updateSettings(newSettings) {
  memoryStore.server_settings = {
    ...memoryStore.server_settings,
    ...newSettings,
    updated_at: new Date().toISOString()
  };
  saveData();
  return memoryStore.server_settings;
}

function getAdminByUsername(username) {
  return (memoryStore.admins || []).find(a => a.username === username);
}

function getAdminById(id) {
  return (memoryStore.admins || []).find(a => a.id === Number(id));
}

function updateAdminPassword(adminId, newPasswordHash) {
  const admin = getAdminById(adminId);
  if (admin) {
    admin.password_hash = newPasswordHash;
    saveData();
    return true;
  }
  return false;
}

function getApk() {
  return memoryStore.apk;
}

function updateApk(apkData) {
  memoryStore.apk = {
    ...memoryStore.apk,
    ...apkData,
    updated_at: new Date().toISOString()
  };
  saveData();
  return memoryStore.apk;
}

function incrementApkDownloads() {
  if (memoryStore.apk) {
    memoryStore.apk.download_count = (memoryStore.apk.download_count || 0) + 1;
    saveData();
    return memoryStore.apk.download_count;
  }
  return 0;
}

module.exports = {
  initDB,
  getSettings,
  updateSettings,
  getAdminByUsername,
  getAdminById,
  updateAdminPassword,
  getApk,
  updateApk,
  incrementApkDownloads
};
