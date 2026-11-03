const { getSettings, updateSettings } = require('../config/db');

async function getServerInfo(req, res) {
  try {
    const settings = getSettings();
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

    const updated = updateSettings({
      java_address: (java_address || '').trim(),
      java_port: (java_port || '25565').trim(),
      java_version: (java_version || '26.3').trim(),
      java_launcher: (java_launcher || 'TLauncher').trim(),
      java_hosting: (java_hosting || 'Aternos').trim(),
      bedrock_address: (bedrock_address || '').trim(),
      bedrock_port: (bedrock_port || '19132').trim(),
      bedrock_version: (bedrock_version || 'Latest Bedrock').trim(),
      bedrock_platform: (bedrock_platform || 'Android & Bedrock Devices').trim(),
      bedrock_hosting: (bedrock_hosting || 'Aternos').trim(),
      announcement: (announcement || '').trim()
    });

    return res.json({
      success: true,
      message: 'Server settings updated successfully.',
      data: updated
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
