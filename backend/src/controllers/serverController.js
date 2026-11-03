const { query } = require('../config/db');

/**
 * Public endpoint: Get server details and connection instructions
 */
async function getServerInfo(req, res) {
  try {
    const result = await query('SELECT * FROM server_settings ORDER BY id ASC LIMIT 1');
    const settings = result.rows[0] || {
      java_address: '',
      java_port: '25565',
      java_version: '26.3',
      java_launcher: 'TLauncher',
      java_hosting: 'Aternos',
      bedrock_address: '',
      bedrock_port: '19132',
      bedrock_version: 'Latest Bedrock',
      bedrock_platform: 'Android and other supported Bedrock devices',
      bedrock_hosting: 'Aternos',
      announcement: 'Welcome to our Minecraft community! Server connection details are configured by the admin.'
    };

    return res.json({
      success: true,
      data: {
        java: {
          game: 'Minecraft Java Edition',
          address: settings.java_address || '',
          port: settings.java_port || '25565',
          version: settings.java_version || '26.3',
          launcher: settings.java_launcher || 'TLauncher',
          hosting: settings.java_hosting || 'Aternos',
          isConfigured: Boolean(settings.java_address && settings.java_address.trim().length > 0),
          instructions: 'Open your Minecraft Java Edition launcher (such as TLauncher). Navigate to Multiplayer -> Add Server. Enter a Server Name and paste the displayed Server Address and Port.'
        },
        bedrock: {
          game: 'Minecraft Bedrock Edition',
          address: settings.bedrock_address || '',
          port: settings.bedrock_port || '19132',
          version: settings.bedrock_version || 'Latest Bedrock',
          platform: settings.bedrock_platform || 'Android and other supported Bedrock devices',
          hosting: settings.bedrock_hosting || 'Aternos',
          isConfigured: Boolean(settings.bedrock_address && settings.bedrock_address.trim().length > 0),
          instructions: 'Launch Minecraft Bedrock on your Android or supported device. Tap Play -> Servers tab -> Scroll down and tap Add Server. Enter the Server Name, paste the Server Address and Port separately, then tap Save and Join.'
        },
        announcement: settings.announcement,
        updatedAt: settings.updated_at
      }
    });
  } catch (err) {
    console.error('[SERVER CONTROLLER] Error fetching server info:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve server details.'
    });
  }
}

/**
 * Admin protected endpoint: Update server settings
 */
async function updateServerSettings(req, res) {
  try {
    const {
      java_address,
      java_port,
      java_version,
      java_launcher,
      java_hosting,
      bedrock_address,
      bedrock_port,
      bedrock_version,
      bedrock_platform,
      bedrock_hosting,
      announcement
    } = req.body;

    const result = await query(
      `UPDATE server_settings
       SET java_address = $1,
           java_port = $2,
           java_version = $3,
           java_launcher = $4,
           java_hosting = $5,
           bedrock_address = $6,
           bedrock_port = $7,
           bedrock_version = $8,
           bedrock_platform = $9,
           bedrock_hosting = $10,
           announcement = $11,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = (SELECT id FROM server_settings ORDER BY id ASC LIMIT 1)
       RETURNING *`,
      [
        (java_address || '').trim(),
        (java_port || '25565').trim(),
        (java_version || '26.3').trim(),
        (java_launcher || 'TLauncher').trim(),
        (java_hosting || 'Aternos').trim(),
        (bedrock_address || '').trim(),
        (bedrock_port || '19132').trim(),
        (bedrock_version || 'Latest Bedrock').trim(),
        (bedrock_platform || 'Android and other supported Bedrock devices').trim(),
        (bedrock_hosting || 'Aternos').trim(),
        (announcement || '').trim()
      ]
    );

    return res.json({
      success: true,
      message: 'Server settings updated successfully.',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('[SERVER CONTROLLER] Error updating server settings:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update server settings.'
    });
  }
}

module.exports = {
  getServerInfo,
  updateServerSettings
};
