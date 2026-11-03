const {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'minecraft-storage';

const isR2Configured = Boolean(
  accountId &&
  accessKeyId &&
  secretAccessKey &&
  !accessKeyId.includes('your_r2')
);

let s3Client = null;

if (isR2Configured) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
  console.log('[R2] Cloudflare R2 S3 client initialized.');
} else {
  console.log('[R2] Notice: Cloudflare R2 credentials not fully configured. Operating in local simulation mode for upload/download testing.');
}

/**
 * Creates a multipart upload session in Cloudflare R2
 */
async function initiateMultipartUpload(key, contentType = 'application/vnd.android.package-archive') {
  if (!isR2Configured || !s3Client) {
    const mockUploadId = `mock_upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return { uploadId: mockUploadId, key, bucket: bucketName, simulated: true };
  }

  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType
  });

  const response = await s3Client.send(command);
  return {
    uploadId: response.UploadId,
    key,
    bucket: bucketName,
    simulated: false
  };
}

/**
 * Generates a presigned URL for a specific chunk (PartNumber)
 */
async function getPresignedPartUrl(key, uploadId, partNumber) {
  if (!isR2Configured || !s3Client) {
    // Return a mock upload URL for local simulation
    return {
      presignedUrl: `/api/apk/mock-chunk-upload?key=${encodeURIComponent(key)}&partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`,
      partNumber,
      simulated: true
    };
  }

  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber
  });

  // Short-lived URL (15 minutes)
  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return {
    presignedUrl,
    partNumber,
    simulated: false
  };
}

/**
 * Completes a multipart upload session after all parts are uploaded
 */
async function completeMultipartUpload(key, uploadId, parts) {
  if (!isR2Configured || !s3Client) {
    return { location: `mock://r2/${bucketName}/${key}`, simulated: true };
  }

  // parts should be array of { PartNumber, ETag }
  const formattedParts = parts
    .sort((a, b) => a.PartNumber - b.PartNumber)
    .map(p => ({
      PartNumber: Number(p.PartNumber),
      ETag: p.ETag.replace(/"/g, '') // sanitize quotes if present
    }));

  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: formattedParts
    }
  });

  const response = await s3Client.send(command);
  return {
    location: response.Location || `https://${bucketName}.r2.cloudflarestorage.com/${key}`,
    simulated: false
  };
}

/**
 * Aborts a multipart upload to clean up orphan parts
 */
async function abortMultipartUpload(key, uploadId) {
  if (!isR2Configured || !s3Client) {
    return { aborted: true, simulated: true };
  }

  const command = new AbortMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    UploadId: uploadId
  });

  await s3Client.send(command);
  return { aborted: true, simulated: false };
}

/**
 * Deletes an object from R2
 */
async function deleteR2Object(key) {
  if (!isR2Configured || !s3Client) {
    return { deleted: true, simulated: true };
  }

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  await s3Client.send(command);
  return { deleted: true, simulated: false };
}

/**
 * Generates a direct presigned download URL with Content-Disposition
 */
async function getDirectDownloadUrl(key, filename) {
  if (!isR2Configured || !s3Client) {
    return {
      downloadUrl: `/api/apk/mock-download/${encodeURIComponent(filename)}`,
      simulated: true,
      expiresInSeconds: 900
    };
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '_')}"`,
    ResponseContentType: 'application/vnd.android.package-archive'
  });

  // Presigned URL valid for 15 minutes (900 seconds)
  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return {
    downloadUrl,
    simulated: false,
    expiresInSeconds: 900
  };
}

module.exports = {
  isR2Configured: () => isR2Configured,
  initiateMultipartUpload,
  getPresignedPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  deleteR2Object,
  getDirectDownloadUrl
};
