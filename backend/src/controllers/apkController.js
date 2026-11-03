const crypto = require('crypto');
const { query } = require('../config/db');
const {
  initiateMultipartUpload,
  getPresignedPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  deleteR2Object,
  getDirectDownloadUrl
} = require('../config/r2');

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB limit

/**
 * Public endpoint: Get published APK metadata
 */
async function getPublishedApk(req, res) {
  try {
    const result = await query(
      'SELECT id, file_name, file_size, version, sha256_hash, description, download_count, created_at, updated_at FROM apk_files WHERE is_published = true ORDER BY id DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        available: false,
        message: 'No authorized APK has been published yet.'
      });
    }

    const apk = result.rows[0];
    return res.json({
      success: true,
      available: true,
      apk: {
        id: apk.id,
        fileName: apk.file_name,
        fileSize: Number(apk.file_size),
        fileSizeFormatted: formatBytes(Number(apk.file_size)),
        version: apk.version,
        sha256Hash: apk.sha256_hash,
        description: apk.description,
        downloadCount: apk.download_count,
        updatedAt: apk.updated_at
      }
    });
  } catch (err) {
    console.error('[APK CONTROLLER] Error fetching published APK:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve APK information.' });
  }
}

/**
 * Public endpoint: Direct download URL generator
 * Increments download count and generates a short-lived presigned R2 URL
 */
async function getDownloadUrl(req, res) {
  try {
    const result = await query(
      'SELECT id, file_name, file_size, sha256_hash, r2_key FROM apk_files WHERE is_published = true ORDER BY id DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No published APK is currently available for download.'
      });
    }

    const apk = result.rows[0];

    // Atomically increment download counter
    await query('UPDATE apk_files SET download_count = download_count + 1 WHERE id = $1', [apk.id]);

    // Generate direct presigned download URL from Cloudflare R2
    const { downloadUrl, simulated, expiresInSeconds } = await getDirectDownloadUrl(apk.r2_key, apk.file_name);

    if (req.query.redirect === 'true') {
      return res.redirect(downloadUrl);
    }

    return res.json({
      success: true,
      downloadUrl,
      fileName: apk.file_name,
      fileSize: Number(apk.file_size),
      sha256Hash: apk.sha256_hash,
      expiresInSeconds,
      simulated
    });
  } catch (err) {
    console.error('[APK CONTROLLER] Error generating download URL:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate download link.' });
  }
}

/**
 * Admin protected: Initiate multipart upload with SHA-256 verification setup & ownership tracking
 */
async function initiateUpload(req, res) {
  try {
    const { fileName, fileSize, version, sha256Hash, description } = req.body;

    // Validation
    if (!fileName || typeof fileName !== 'string' || !fileName.toLowerCase().endsWith('.apk')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file. Only .apk files are supported.'
      });
    }

    const sizeNum = Number(fileSize);
    if (isNaN(sizeNum) || sizeNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file size.'
      });
    }

    if (sizeNum > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        error: `File size exceeds the maximum allowed limit of 1 GB (${formatBytes(MAX_FILE_SIZE)}).`
      });
    }

    if (!version || typeof version !== 'string' || version.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Application version is required.'
      });
    }

    // SHA-256 verification (Requirement 1: 64-char hex string)
    const hashRegex = /^[a-fA-F0-9]{64}$/;
    if (!sha256Hash || !hashRegex.test(sha256Hash.trim())) {
      return res.status(400).json({
        success: false,
        error: 'A valid 64-character SHA-256 checksum is required for integrity verification.'
      });
    }

    // Generate unique storage key in R2
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(6).toString('hex');
    const r2Key = `apks/${timestamp}-${randomHex}/${sanitizedFileName}`;

    // Initiate multipart upload in Cloudflare R2
    const { uploadId, key, simulated } = await initiateMultipartUpload(r2Key, 'application/vnd.android.package-archive');

    // Requirement 2: Track active upload session with ownership validation tied to req.admin.id
    await query(
      `INSERT INTO active_uploads (upload_id, r2_key, file_name, file_size, version, sha256_hash, description, admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        uploadId,
        key,
        sanitizedFileName,
        sizeNum,
        version.trim(),
        sha256Hash.trim().toLowerCase(),
        (description || '').trim(),
        req.admin.id
      ]
    );

    // Recommended part size for browser multipart upload (10 MB chunks)
    const chunkSize = 10 * 1024 * 1024;
    const totalParts = Math.ceil(sizeNum / chunkSize);

    return res.json({
      success: true,
      uploadId,
      key,
      chunkSize,
      totalParts,
      simulated
    });
  } catch (err) {
    console.error('[APK CONTROLLER] Error initiating upload:', err);
    return res.status(500).json({ success: false, error: 'Failed to initiate multipart upload.' });
  }
}

/**
 * Admin protected: Generate presigned URL for an upload part
 * Validates upload ownership against req.admin.id
 */
async function presignPart(req, res) {
  try {
    const { uploadId, partNumber } = req.body;

    if (!uploadId || !partNumber || isNaN(Number(partNumber)) || Number(partNumber) < 1) {
      return res.status(400).json({
        success: false,
        error: 'Valid uploadId and partNumber (> 0) are required.'
      });
    }

    // Requirement 2: Verify active upload session and admin ownership
    const uploadCheck = await query('SELECT * FROM active_uploads WHERE upload_id = $1', [uploadId]);
    if (uploadCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found or has already expired.'
      });
    }

    const activeUpload = uploadCheck.rows[0];
    if (Number(activeUpload.admin_id) !== Number(req.admin.id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to modify this upload session.'
      });
    }

    const { presignedUrl, simulated } = await getPresignedPartUrl(
      activeUpload.r2_key,
      uploadId,
      Number(partNumber)
    );

    return res.json({
      success: true,
      presignedUrl,
      partNumber: Number(partNumber),
      simulated
    });
  } catch (err) {
    console.error('[APK CONTROLLER] Error presigning part:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate part upload URL.' });
  }
}

/**
 * Admin protected: Complete multipart upload
 * Validates ownership, completes R2 session, and registers APK in database
 */
async function completeUpload(req, res) {
  try {
    const { uploadId, parts } = req.body;

    if (!uploadId || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid uploadId and completed parts array are required.'
      });
    }

    // Requirement 2: Verify upload ownership
    const uploadCheck = await query('SELECT * FROM active_uploads WHERE upload_id = $1', [uploadId]);
    if (uploadCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found or has expired.'
      });
    }

    const activeUpload = uploadCheck.rows[0];
    if (Number(activeUpload.admin_id) !== Number(req.admin.id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not own this upload session.'
      });
    }

    // Complete Cloudflare R2 multipart upload
    const { location, simulated } = await completeMultipartUpload(activeUpload.r2_key, uploadId, parts);

    // Unpublish previous APKs and register the new one
    await query('UPDATE apk_files SET is_published = false');
    const newFile = await query(
      `INSERT INTO apk_files (file_name, file_size, version, sha256_hash, description, r2_key, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, file_name, file_size, version, sha256_hash, description, download_count, created_at`,
      [
        activeUpload.file_name,
        activeUpload.file_size,
        activeUpload.version,
        activeUpload.sha256_hash,
        activeUpload.description,
        activeUpload.r2_key
      ]
    );

    // Clean up active upload session
    await query('DELETE FROM active_uploads WHERE upload_id = $1', [uploadId]);

    return res.json({
      success: true,
      message: 'APK upload successfully completed and published.',
      apk: newFile.rows[0],
      location,
      simulated
    });
  } catch (err) {
    console.error('[APK CONTROLLER] Error completing upload:', err);
    return res.status(500).json({ success: false, error: 'Failed to complete multipart upload.' });
  }
}

/**
 * Admin protected: Abort multipart upload
 */
async function abortUpload(req, res) {
  try {
    const { uploadId } = req.body;
    if (!uploadId) {
      return res.status(400).json({ success: false, error: 'uploadId is required.' });
    }

    const uploadCheck = await query('SELECT * FROM active_uploads WHERE upload_id = $1', [uploadId]);
    if (uploadCheck.rows.length > 0) {
      const activeUpload = uploadCheck.rows[0];
      if (Number(activeUpload.admin_id) !== Number(req.admin.id)) {
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }

      await abortMultipartUpload(activeUpload.r2_key, uploadId);
      await query('DELETE FROM active_uploads WHERE upload_id = $1', [uploadId]);
    }

    return res.json({
      success: true,
      message: 'Upload aborted and resources cleaned up.'
    });
  } catch (err) {
    console.error('[APK CONTROLLER] Error aborting upload:', err);
    return res.status(500).json({ success: false, error: 'Failed to abort upload.' });
  }
}

/**
 * Admin protected: Delete published APK
 */
async function deleteApk(req, res) {
  try {
    const { id } = req.params;
    const fileResult = await query('SELECT id, r2_key FROM apk_files WHERE id = $1', [id]);

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'APK file record not found.' });
    }

    const apk = fileResult.rows[0];
    await deleteR2Object(apk.r2_key);
    await query('DELETE FROM apk_files WHERE id = $1', [id]);

    return res.json({
      success: true,
      message: 'APK file deleted successfully.'
    });
  } catch (err) {
    console.error('[APK CONTROLLER] Error deleting APK:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete APK.' });
  }
}

/**
 * Admin protected: List all APK files
 */
async function listAllApks(req, res) {
  try {
    const result = await query('SELECT * FROM apk_files ORDER BY created_at DESC');
    return res.json({
      success: true,
      files: result.rows.map(f => ({
        ...f,
        fileSizeFormatted: formatBytes(Number(f.file_size))
      }))
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to list APK records.' });
  }
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = {
  getPublishedApk,
  getDownloadUrl,
  initiateUpload,
  presignPart,
  completeUpload,
  abortUpload,
  deleteApk,
  listAllApks
};
