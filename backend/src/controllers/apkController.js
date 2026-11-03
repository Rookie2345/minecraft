const { getApk, updateApk, incrementApkDownloads } = require('../config/db');

/**
 * Public endpoint: Get published APK metadata
 */
async function getPublishedApk(req, res) {
  try {
    const apk = getApk();

    if (!apk || !apk.is_published || !apk.download_url) {
      return res.json({
        success: true,
        available: false,
        message: 'No authorized APK has been published yet.'
      });
    }

    return res.json({
      success: true,
      available: true,
      apk: {
        fileName: apk.file_name || 'Minecraft-Companion.apk',
        fileSizeFormatted: apk.file_size_formatted || '400 MB',
        version: apk.version || '1.0',
        sha256Hash: apk.sha256_hash || '',
        description: apk.description || 'Official community-authorized companion client.',
        downloadCount: apk.download_count || 0,
        updatedAt: apk.updated_at
      }
    });
  } catch (err) {
    console.error('[APK CONTROLLER] Error fetching APK info:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve APK information.' });
  }
}

/**
 * Public endpoint: Direct download URL generator
 * Increments download count and returns the download link or redirects
 */
async function getDownloadUrl(req, res) {
  try {
    const apk = getApk();

    if (!apk || !apk.is_published || !apk.download_url) {
      return res.status(404).json({
        success: false,
        error: 'No published APK is currently available for download.'
      });
    }

    // Increment download counter
    incrementApkDownloads();

    if (req.query.redirect === 'true') {
      return res.redirect(apk.download_url);
    }

    return res.json({
      success: true,
      downloadUrl: apk.download_url,
      fileName: apk.file_name,
      fileSizeFormatted: apk.file_size_formatted,
      sha256Hash: apk.sha256_hash
    });
  } catch (err) {
    console.error('[APK CONTROLLER] Error generating download URL:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate download link.' });
  }
}

/**
 * Admin protected: Publish or update APK details
 * Eliminates R2 requirement; accepts Google Drive, MediaFire, GitHub Releases, or direct URLs
 */
async function publishApk(req, res) {
  try {
    const { downloadUrl, fileName, fileSizeFormatted, version, sha256Hash, description } = req.body;

    if (!downloadUrl || typeof downloadUrl !== 'string' || !downloadUrl.trim().startsWith('http')) {
      return res.status(400).json({
        success: false,
        error: 'A valid download URL (Google Drive, MediaFire, GitHub Release, or direct link) is required.'
      });
    }

    if (!version || typeof version !== 'string' || version.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Application version is required.'
      });
    }

    const updated = updateApk({
      is_published: true,
      download_url: downloadUrl.trim(),
      file_name: (fileName || 'Minecraft-Bedrock.apk').trim(),
      file_size_formatted: (fileSizeFormatted || '400 MB').trim(),
      version: version.trim(),
      sha256_hash: (sha256Hash || '').trim().toLowerCase(),
      description: (description || '').trim()
    });

    return res.json({
      success: true,
      message: 'APK package successfully published.',
      apk: updated
    });
  } catch (err) {
    console.error('[APK CONTROLLER] Error publishing APK:', err);
    return res.status(500).json({ success: false, error: 'Failed to publish APK.' });
  }
}

/**
 * Admin protected: Unpublish or delete APK
 */
async function unpublishApk(req, res) {
  try {
    updateApk({
      is_published: false,
      download_url: ''
    });

    return res.json({
      success: true,
      message: 'APK has been unpublished from the public portal.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to unpublish APK.' });
  }
}

/**
 * Admin protected: Get full APK admin settings
 */
async function getAdminApkDetails(req, res) {
  try {
    const apk = getApk();
    return res.json({
      success: true,
      apk
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve APK details.' });
  }
}

module.exports = {
  getPublishedApk,
  getDownloadUrl,
  publishApk,
  unpublishApk,
  getAdminApkDetails
};
