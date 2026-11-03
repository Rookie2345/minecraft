const {
  getSettings,
  updateSettings,
  getAccessRequests,
  addAccessRequest,
  updateAccessRequestStatus,
  deleteAccessRequest
} = require('../config/db');

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

/**
 * Public endpoint: Submit Aternos username for server start access
 * Strictly rejects links / URLs to prevent phishing
 */
async function submitAccessRequest(req, res) {
  try {
    const { aternos_username, minecraft_ign, note } = req.body;

    if (!aternos_username || typeof aternos_username !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Aternos username is required.'
      });
    }

    const cleanUsername = aternos_username.trim();

    // Anti-phishing check: strictly reject any links, protocols, or domain patterns
    const urlPattern = /(https?:\/\/|www\.|\.com|\.net|\.org|\.ru|\.gg|\.me|\.xyz|\/|\\|@)/i;
    if (urlPattern.test(cleanUsername) || (note && urlPattern.test(note)) || (minecraft_ign && urlPattern.test(minecraft_ign))) {
      return res.status(400).json({
        success: false,
        error: 'Security Warning: Web links and URLs are strictly forbidden to protect against phishing.'
      });
    }

    // Strict username character validation: letters, numbers, underscores, dots, hyphens (3-30 chars)
    const validUsernamePattern = /^[a-zA-Z0-9_.-]{3,30}$/;
    if (!validUsernamePattern.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid username. Please enter a valid Aternos username (3–30 characters, letters/numbers/underscores only).'
      });
    }

    // Sanitize optional fields
    const cleanIgn = minecraft_ign ? String(minecraft_ign).trim().substring(0, 30) : '';
    const cleanNote = note ? String(note).trim().substring(0, 100) : '';

    const newRequest = addAccessRequest({
      aternos_username: cleanUsername,
      minecraft_ign: cleanIgn,
      note: cleanNote
    });

    return res.json({
      success: true,
      message: 'Access request submitted! An administrator will add your Aternos account so you can start the server.',
      request: {
        id: newRequest.id,
        aternos_username: newRequest.aternos_username,
        status: newRequest.status
      }
    });
  } catch (err) {
    console.error('[SERVER CONTROLLER] Error submitting access request:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit access request.'
    });
  }
}

/**
 * Admin protected: Get all Aternos access requests
 */
async function listAccessRequests(req, res) {
  try {
    const requests = getAccessRequests();
    return res.json({
      success: true,
      requests
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve access requests.'
    });
  }
}

/**
 * Admin protected: Update request status (e.g. 'granted' or 'pending')
 */
async function updateRequestStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'granted'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be pending or granted.' });
    }

    const updated = updateAccessRequestStatus(id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Request not found.' });
    }

    return res.json({
      success: true,
      message: `Request status updated to ${status}.`,
      request: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update request status.' });
  }
}

/**
 * Admin protected: Delete access request
 */
async function removeAccessRequest(req, res) {
  try {
    const { id } = req.params;
    const removed = deleteAccessRequest(id);

    if (!removed) {
      return res.status(404).json({ success: false, error: 'Request not found.' });
    }

    return res.json({
      success: true,
      message: 'Access request removed.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to delete request.' });
  }
}

module.exports = {
  getServerInfo,
  updateServerSettings,
  submitAccessRequest,
  listAccessRequests,
  updateRequestStatus,
  removeAccessRequest
};
