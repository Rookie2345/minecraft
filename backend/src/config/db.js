const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'portal-data.json');

let pgPool = null;
let isUsingPostgres = false;

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
    discord_url: '',
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
  },
  access_requests: []
};

let memoryStore = { ...defaultData };

function loadDataFromFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      memoryStore = {
        ...defaultData,
        ...parsed,
        server_settings: { ...defaultData.server_settings, ...(parsed.server_settings || {}) },
        apk: { ...defaultData.apk, ...(parsed.apk || {}) },
        admins: parsed.admins || [],
        access_requests: parsed.access_requests || []
      };
    } else {
      saveData();
    }
  } catch (err) {
    console.warn('[STORAGE] Using in-memory fallback:', err.message);
  }
}

function saveData() {
  // 1. Local file cache
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (err) {
    console.error('[STORAGE] Error writing local data file:', err.message);
  }

  // 2. PostgreSQL persistence if connected
  if (isUsingPostgres && pgPool) {
    pgPool.query(
      `INSERT INTO portal_store (key, data, updated_at) VALUES ('portal_state', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(memoryStore)]
    ).catch(err => {
      console.error('[STORAGE ERROR] Failed to persist data to PostgreSQL:', err.message);
    });
  }
}

async function initDB() {
  // 1. First load local file cache if it exists
  loadDataFromFile();

  // 2. Try connecting to PostgreSQL (uses process.env.DATABASE_URL or verified Neon database)
  const defaultNeonUrl = 'postgresql://neondb_owner:npg_GpxPFJCb97Nu@ep-odd-feather-a1b6bdro-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  const dbUrl = (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0)
    ? process.env.DATABASE_URL.trim()
    : defaultNeonUrl;

  if (dbUrl && dbUrl.trim().length > 0) {
    try {
      console.log('[STORAGE] Connecting to PostgreSQL database...');
      pgPool = new Pool({
        connectionString: dbUrl.trim(),
        ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000
      });

      const client = await pgPool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS portal_store (
            key VARCHAR(64) PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        const res = await client.query(`SELECT data FROM portal_store WHERE key = 'portal_state'`);
        if (res.rows.length > 0 && res.rows[0].data) {
          const dbData = res.rows[0].data;
          memoryStore = {
            ...defaultData,
            ...dbData,
            server_settings: {
              ...defaultData.server_settings,
              ...(dbData.server_settings || {})
            },
            apk: {
              ...defaultData.apk,
              ...(dbData.apk || {})
            },
            admins: dbData.admins || [],
            access_requests: dbData.access_requests || []
          };
          console.log('[STORAGE] [OK] Successfully restored portal state from PostgreSQL database!');
        } else {
          await client.query(
            `INSERT INTO portal_store (key, data, updated_at) VALUES ('portal_state', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`,
            [JSON.stringify(memoryStore)]
          );
          console.log('[STORAGE] [OK] Initialized portal state in PostgreSQL database.');
        }
        isUsingPostgres = true;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[STORAGE WARNING] PostgreSQL connection failed:', err.message);
      console.warn('[STORAGE WARNING] Running in local file mode. Note: on free hosts like Render, local files do not persist across restarts.');
      isUsingPostgres = false;
    }
  } else {
    console.log('[STORAGE] No DATABASE_URL set. Running in local file mode.');
    console.warn('[STORAGE] Note: on Render free tier, set DATABASE_URL (e.g. from Neon.tech) to persist changes across restarts.');
  }

  // 3. NON-DESTRUCTIVE Seed from env vars ONLY if values are currently empty!
  // This guarantees that any changes made by the admin in the Admin Panel
  // are NEVER overwritten by old environment variables on restart!
  let shouldSave = false;

  if (!memoryStore.server_settings.java_address && process.env.DEFAULT_JAVA_ADDRESS) {
    memoryStore.server_settings.java_address = process.env.DEFAULT_JAVA_ADDRESS;
    shouldSave = true;
  }
  if (!memoryStore.server_settings.java_port && process.env.DEFAULT_JAVA_PORT) {
    memoryStore.server_settings.java_port = process.env.DEFAULT_JAVA_PORT;
    shouldSave = true;
  }
  if (!memoryStore.server_settings.bedrock_address && process.env.DEFAULT_BEDROCK_ADDRESS) {
    memoryStore.server_settings.bedrock_address = process.env.DEFAULT_BEDROCK_ADDRESS;
    shouldSave = true;
  }
  if (!memoryStore.server_settings.bedrock_port && process.env.DEFAULT_BEDROCK_PORT) {
    memoryStore.server_settings.bedrock_port = process.env.DEFAULT_BEDROCK_PORT;
    shouldSave = true;
  }
  if (!memoryStore.server_settings.discord_url && process.env.DEFAULT_DISCORD_URL) {
    memoryStore.server_settings.discord_url = process.env.DEFAULT_DISCORD_URL;
    shouldSave = true;
  }
  if (!memoryStore.server_settings.announcement && process.env.DEFAULT_ANNOUNCEMENT) {
    memoryStore.server_settings.announcement = process.env.DEFAULT_ANNOUNCEMENT;
    shouldSave = true;
  }
  if (!memoryStore.apk.download_url && process.env.DEFAULT_APK_URL) {
    memoryStore.apk = {
      ...memoryStore.apk,
      download_url: process.env.DEFAULT_APK_URL,
      version: process.env.DEFAULT_APK_VERSION || memoryStore.apk.version,
      file_size_formatted: process.env.DEFAULT_APK_SIZE || memoryStore.apk.file_size_formatted,
      file_name: process.env.DEFAULT_APK_NAME || memoryStore.apk.file_name,
      is_published: true
    };
    shouldSave = true;
  }

  // 4. Initialize administrator account
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';

  if (!memoryStore.admins) memoryStore.admins = [];
  memoryStore.admins = memoryStore.admins.filter(a => a.username !== 'testadmin');

  let admin = memoryStore.admins.find(a => a.username === adminUsername);

  if (!admin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    admin = {
      id: 1,
      username: adminUsername,
      password_hash: passwordHash,
      created_at: new Date().toISOString()
    };
    memoryStore.admins.push(admin);
    shouldSave = true;
    console.log(`[STORAGE] Administrator account initialized: "${adminUsername}".`);
  } else if (process.env.ADMIN_PASSWORD) {
    const isMatch = await bcrypt.compare(adminPassword, admin.password_hash);
    if (!isMatch) {
      admin.password_hash = await bcrypt.hash(adminPassword, 10);
      shouldSave = true;
      console.log(`[STORAGE] Synced password for administrator "${adminUsername}" from environment.`);
    }
  }

  if (shouldSave) {
    saveData();
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

function getAccessRequests() {
  if (!memoryStore.access_requests) memoryStore.access_requests = [];
  return memoryStore.access_requests;
}

function addAccessRequest(data) {
  if (!memoryStore.access_requests) memoryStore.access_requests = [];
  const newReq = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    aternos_username: data.aternos_username,
    minecraft_ign: data.minecraft_ign || '',
    note: data.note || '',
    status: 'pending', // 'pending' | 'granted'
    created_at: new Date().toISOString()
  };
  memoryStore.access_requests.unshift(newReq);
  saveData();
  return newReq;
}

function updateAccessRequestStatus(id, status) {
  if (!memoryStore.access_requests) return null;
  const req = memoryStore.access_requests.find(r => r.id === Number(id));
  if (req) {
    req.status = status;
    req.updated_at = new Date().toISOString();
    saveData();
    return req;
  }
  return null;
}

function deleteAccessRequest(id) {
  if (!memoryStore.access_requests) return false;
  const idx = memoryStore.access_requests.findIndex(r => r.id === Number(id));
  if (idx !== -1) {
    memoryStore.access_requests.splice(idx, 1);
    saveData();
    return true;
  }
  return false;
}

function getStorageInfo() {
  return {
    isPersistent: isUsingPostgres,
    type: isUsingPostgres ? 'postgresql' : 'ephemeral_file',
    message: isUsingPostgres
      ? 'Persistent Database Connected (Changes saved permanently)'
      : 'Temporary File Storage (Resets when server restarts — add DATABASE_URL to save permanently)'
  };
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
  incrementApkDownloads,
  getAccessRequests,
  addAccessRequest,
  updateAccessRequestStatus,
  deleteAccessRequest,
  getStorageInfo
};
