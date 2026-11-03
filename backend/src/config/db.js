const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

let pool = null;
let isInMemoryFallback = false;

// Fallback in-memory data store for local development when DATABASE_URL is not yet configured
const inMemoryStore = {
  admins: [],
  server_settings: [
    {
      id: 1,
      java_address: 'play.ourcraft.aternos.me',
      java_port: '25565',
      java_version: '26.3',
      java_launcher: 'TLauncher',
      java_hosting: 'Aternos',
      bedrock_address: 'play.ourcraft.aternos.me',
      bedrock_port: '19132',
      bedrock_version: 'Latest Bedrock (v1.20+)',
      bedrock_platform: 'Android & Bedrock Devices',
      bedrock_hosting: 'Aternos',
      announcement: 'Welcome to our Minecraft Community Server! Java and Bedrock cross-play enabled.',
      updated_at: new Date()
    }
  ],
  apk_files: [],
  active_uploads: []
};

let autoIncrementIds = {
  admins: 1,
  apk_files: 1,
  active_uploads: 1
};

async function initDB() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && !databaseUrl.includes('YOUR_PASSWORD') && !databaseUrl.includes('ep-sample-pooler')) {
    console.log('[DB] Connecting to PostgreSQL database...');
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DB_SSL_DISABLE === 'true' ? false : { rejectUnauthorized: false }
    });

    try {
      const client = await pool.connect();
      console.log('[DB] Successfully connected to PostgreSQL.');

      // Initialize schema
      await client.query(`
        CREATE TABLE IF NOT EXISTS admins (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS server_settings (
          id SERIAL PRIMARY KEY,
          java_address VARCHAR(255) DEFAULT '',
          java_port VARCHAR(50) DEFAULT '25565',
          java_version VARCHAR(50) DEFAULT '26.3',
          java_launcher VARCHAR(100) DEFAULT 'TLauncher',
          java_hosting VARCHAR(100) DEFAULT 'Aternos',
          bedrock_address VARCHAR(255) DEFAULT '',
          bedrock_port VARCHAR(50) DEFAULT '19132',
          bedrock_version VARCHAR(50) DEFAULT 'Latest Bedrock',
          bedrock_platform VARCHAR(100) DEFAULT 'Android & Bedrock Devices',
          bedrock_hosting VARCHAR(100) DEFAULT 'Aternos',
          announcement TEXT DEFAULT 'Welcome to our Minecraft community!',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS apk_files (
          id SERIAL PRIMARY KEY,
          file_name VARCHAR(255) NOT NULL,
          file_size BIGINT NOT NULL,
          version VARCHAR(50) NOT NULL,
          sha256_hash VARCHAR(64) NOT NULL,
          description TEXT DEFAULT '',
          r2_key VARCHAR(500) NOT NULL,
          download_count INT DEFAULT 0,
          is_published BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS active_uploads (
          id SERIAL PRIMARY KEY,
          upload_id VARCHAR(255) UNIQUE NOT NULL,
          r2_key VARCHAR(500) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_size BIGINT NOT NULL,
          version VARCHAR(50) NOT NULL,
          sha256_hash VARCHAR(64) NOT NULL,
          description TEXT DEFAULT '',
          admin_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed default server settings if table is empty
      const settingsCheck = await client.query('SELECT id FROM server_settings LIMIT 1');
      if (settingsCheck.rows.length === 0) {
        await client.query(`
          INSERT INTO server_settings (
            java_address, java_port, java_version, java_launcher, java_hosting,
            bedrock_address, bedrock_port, bedrock_version, bedrock_platform, bedrock_hosting,
            announcement
          ) VALUES (
            '', '25565', '26.3', 'TLauncher', 'Aternos',
            '', '19132', 'Latest Bedrock', 'Android & Bedrock Devices', 'Aternos',
            'Welcome to our Minecraft Community Server! Configure connection details in the Admin Panel.'
          )
        `);
      }

      // Seed initial admin if needed
      await seedAdminPostgres(client);
      client.release();
      return;
    } catch (err) {
      console.error('[DB] PostgreSQL initialization failed:', err.message);
      console.log('[DB] Falling back to local in-memory store for local testing.');
      isInMemoryFallback = true;
    }
  } else {
    console.log('[DB] No valid DATABASE_URL provided. Running with local in-memory storage.');
    isInMemoryFallback = true;
  }

  // If in-memory fallback is active, seed admin
  await seedAdminInMemory();
}

async function seedAdminPostgres(client) {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (process.env.NODE_ENV === 'production') {
    if (!adminPassword || adminPassword === 'ChangeMe123!' || adminPassword.length < 8) {
      throw new Error(
        '[SECURITY ERROR] In production, ADMIN_PASSWORD must be explicitly provided in environment variables with at least 8 characters.'
      );
    }
  }

  const existingAdmin = await client.query('SELECT id FROM admins WHERE username = $1', [adminUsername]);
  if (existingAdmin.rows.length === 0) {
    const passwordToUse = adminPassword || 'AdminPass123!';
    const passwordHash = await bcrypt.hash(passwordToUse, 12);
    await client.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', [adminUsername, passwordHash]);
    console.log(`[DB] Created initial administrator account: "${adminUsername}".`);
  }
}

async function seedAdminInMemory() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  
  inMemoryStore.admins = [
    {
      id: autoIncrementIds.admins++,
      username: adminUsername,
      password_hash: passwordHash,
      created_at: new Date()
    }
  ];
  console.log(`[DB] Local in-memory admin initialized: "${adminUsername}".`);
}

// Unified query helper
async function query(text, params = []) {
  if (!isInMemoryFallback && pool) {
    return pool.query(text, params);
  }

  // In-memory query simulation for local development testing
  const normalized = text.trim().toLowerCase();

  // SELECT server_settings
  if (normalized.startsWith('select') && normalized.includes('from server_settings')) {
    return { rows: [ { ...inMemoryStore.server_settings[0] } ] };
  }

  // UPDATE server_settings
  if (normalized.startsWith('update server_settings')) {
    // Parameter order matches serverController updateSettings
    const [
      java_address, java_port, java_version, java_launcher, java_hosting,
      bedrock_address, bedrock_port, bedrock_version, bedrock_platform, bedrock_hosting,
      announcement
    ] = params;

    const current = inMemoryStore.server_settings[0];
    Object.assign(current, {
      java_address: java_address !== undefined ? java_address : current.java_address,
      java_port: java_port !== undefined ? java_port : current.java_port,
      java_version: java_version !== undefined ? java_version : current.java_version,
      java_launcher: java_launcher !== undefined ? java_launcher : current.java_launcher,
      java_hosting: java_hosting !== undefined ? java_hosting : current.java_hosting,
      bedrock_address: bedrock_address !== undefined ? bedrock_address : current.bedrock_address,
      bedrock_port: bedrock_port !== undefined ? bedrock_port : current.bedrock_port,
      bedrock_version: bedrock_version !== undefined ? bedrock_version : current.bedrock_version,
      bedrock_platform: bedrock_platform !== undefined ? bedrock_platform : current.bedrock_platform,
      bedrock_hosting: bedrock_hosting !== undefined ? bedrock_hosting : current.bedrock_hosting,
      announcement: announcement !== undefined ? announcement : current.announcement,
      updated_at: new Date()
    });
    return { rows: [ { ...current } ] };
  }

  // SELECT admin by username
  if (normalized.startsWith('select') && normalized.includes('from admins where username')) {
    const username = params[0];
    const found = inMemoryStore.admins.find(a => a.username === username);
    return { rows: found ? [ { ...found } ] : [] };
  }

  // SELECT admin by id
  if (normalized.startsWith('select') && normalized.includes('from admins where id')) {
    const id = params[0];
    const found = inMemoryStore.admins.find(a => a.id === id);
    return { rows: found ? [ { ...found } ] : [] };
  }

  // SELECT published APK
  if (normalized.startsWith('select') && normalized.includes('from apk_files where is_published = true')) {
    const published = inMemoryStore.apk_files.filter(f => f.is_published);
    return { rows: published.length > 0 ? [ { ...published[published.length - 1] } ] : [] };
  }

  // SELECT all APK files
  if (normalized.startsWith('select') && normalized.includes('from apk_files order by')) {
    return { rows: inMemoryStore.apk_files.map(f => ({ ...f })).reverse() };
  }

  // SELECT APK by ID
  if (normalized.startsWith('select') && normalized.includes('from apk_files where id')) {
    const id = params[0];
    const found = inMemoryStore.apk_files.find(f => f.id === Number(id));
    return { rows: found ? [ { ...found } ] : [] };
  }

  // INSERT active_uploads
  if (normalized.startsWith('insert into active_uploads')) {
    const [upload_id, r2_key, file_name, file_size, version, sha256_hash, description, admin_id] = params;
    const newUpload = {
      id: autoIncrementIds.active_uploads++,
      upload_id,
      r2_key,
      file_name,
      file_size: Number(file_size),
      version,
      sha256_hash,
      description,
      admin_id: Number(admin_id),
      created_at: new Date()
    };
    inMemoryStore.active_uploads.push(newUpload);
    return { rows: [ newUpload ] };
  }

  // SELECT active_uploads by upload_id
  if (normalized.startsWith('select') && normalized.includes('from active_uploads where upload_id')) {
    const upload_id = params[0];
    const found = inMemoryStore.active_uploads.find(u => u.upload_id === upload_id);
    return { rows: found ? [ { ...found } ] : [] };
  }

  // DELETE active_uploads
  if (normalized.startsWith('delete from active_uploads where upload_id')) {
    const upload_id = params[0];
    const idx = inMemoryStore.active_uploads.findIndex(u => u.upload_id === upload_id);
    if (idx !== -1) inMemoryStore.active_uploads.splice(idx, 1);
    return { rowCount: 1 };
  }

  // INSERT apk_files
  if (normalized.startsWith('insert into apk_files')) {
    const [file_name, file_size, version, sha256_hash, description, r2_key] = params;
    // Unpublish previous ones
    inMemoryStore.apk_files.forEach(f => { f.is_published = false; });
    const newFile = {
      id: autoIncrementIds.apk_files++,
      file_name,
      file_size: Number(file_size),
      version,
      sha256_hash,
      description,
      r2_key,
      download_count: 0,
      is_published: true,
      created_at: new Date(),
      updated_at: new Date()
    };
    inMemoryStore.apk_files.push(newFile);
    return { rows: [ newFile ] };
  }

  // INCREMENT download_count
  if (normalized.startsWith('update apk_files set download_count = download_count + 1')) {
    const id = params[0];
    const found = inMemoryStore.apk_files.find(f => f.id === Number(id));
    if (found) found.download_count++;
    return { rows: found ? [ { ...found } ] : [] };
  }

  // DELETE from apk_files
  if (normalized.startsWith('delete from apk_files where id')) {
    const id = params[0];
    const idx = inMemoryStore.apk_files.findIndex(f => f.id === Number(id));
    if (idx !== -1) inMemoryStore.apk_files.splice(idx, 1);
    return { rowCount: 1 };
  }

  // UPDATE apk_files (version/description)
  if (normalized.startsWith('update apk_files set version')) {
    const [version, description, id] = params;
    const found = inMemoryStore.apk_files.find(f => f.id === Number(id));
    if (found) {
      found.version = version;
      found.description = description;
      found.updated_at = new Date();
    }
    return { rows: found ? [ { ...found } ] : [] };
  }

  return { rows: [] };
}

module.exports = {
  initDB,
  query,
  isInMemory: () => isInMemoryFallback
};
