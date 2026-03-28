const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, { retries = 3, baseDelayMs = 200 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        await sleep(baseDelayMs * 2 ** attempt);
      }
    }
  }
  throw lastErr;
}

async function putObjectS3({ buffer, key, contentType }, config) {
  const {
    UPLOAD_BUCKET,
    UPLOAD_REGION,
    UPLOAD_ENDPOINT,
    UPLOAD_ACCESS_KEY,
    UPLOAD_SECRET_KEY,
  } = config;

  const client = new S3Client({
    region: UPLOAD_REGION || 'us-east-1',
    endpoint: UPLOAD_ENDPOINT || "",
    credentials: {
      accessKeyId: UPLOAD_ACCESS_KEY,
      secretAccessKey: UPLOAD_SECRET_KEY,
    },
    forcePathStyle: Boolean(UPLOAD_ENDPOINT),
  });

  const cmd = new PutObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  });

  await withRetry(() => client.send(cmd), { retries: 3, baseDelayMs: 250 });
}

async function putObjectLocal({ buffer, key }, config) {
  const { UPLOAD_DIR } = config;
  const fullPath = path.join(UPLOAD_DIR, key);
  const dir = path.dirname(fullPath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(fullPath, buffer);
}

function publicUrlForKey(key, config) {
  const base = (config.UPLOAD_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (base) {
    return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
  const api = (config.API_BASE_URL || '').replace(/\/$/, '');
  return `${api}/uploads/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * @param {object} params
 * @param {Buffer} params.buffer
 * @param {string} params.mime
 * @param {string} params.ext - includes leading dot
 * @param {string} [params.entity]
 * @param {object} config - constants subset (+ NODE_ENV)
 */
async function uploadBuffer(params, config) {
  const { buffer, mime, ext, entity } = params;
  const envSegment = (config.NODE_ENV || 'development').replace(/[^a-z0-9_-]/gi, '') || 'development';
  const safeEntity = String(entity || 'asset')
    .replace(/[^a-z0-9_-]/gi, '')
    .slice(0, 48) || 'asset';
  const id = uuidv4();
  const pfx = (config.UPLOAD_KEY_PREFIX || 'by-excellence')
    .replace(/[^a-z0-9/_-]/gi, '')
    .replace(/^\/+|\/+$/g, '') || 'by-excellence';
  const key = `${pfx}/${envSegment}/${safeEntity}/${id}${ext}`;

  const driver = (config.UPLOAD_DRIVER || 'local').toLowerCase();

  if (driver === 's3') {
    if (!config.UPLOAD_BUCKET || !config.UPLOAD_ACCESS_KEY || !config.UPLOAD_SECRET_KEY) {
      const err = new Error('Object storage is not configured');
      err.code = 'STORAGE_CONFIG';
      throw err;
    }
    await putObjectS3({ buffer, key, contentType: mime }, config);
  } else {
    await putObjectLocal({ buffer, key }, config);
  }

  const publicUrl = publicUrlForKey(key, config);
  return { key, publicUrl };
}

module.exports = {
  uploadBuffer,
  publicUrlForKey,
};
