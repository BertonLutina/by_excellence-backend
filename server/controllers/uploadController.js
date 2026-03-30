const fs = require('fs').promises;
const path = require('path');
const { API_BASE_URL, APP_URL } = require('../../constants/constant');

/** Public URL path matches on-disk layout: public/uploads → /public/uploads/… */
function buildPublicUploadUrl(req, filename) {
  const pathSeg = `/public/uploads/${encodeURIComponent(filename)}`;
  const base = (API_BASE_URL || APP_URL || '').replace(/\/$/, '');
  if (base) {
    return `${base}${pathSeg}`;
  }
  const xfProto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = xfProto || req.protocol || 'http';
  const host = req.get('host');
  if (host) {
    return `${proto}://${host}${pathSeg}`;
  }
  return pathSeg;
}
const { validateFileBuffer } = require('../utils/fileValidation');
const { recordUpload } = require('../models/uploadAudit');

function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return null;
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return base || null;
}

function logUpload(event, meta) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: `upload.${event}`,
      ...meta,
    })
  );
}

exports.upload = async (req, res) => {
  let savedPath;
  try {
    if (!req.file || !req.file.path) {
      console.log('[upload] no file in request (field name must be "file")');
      logUpload('reject', { reason: 'missing_file' });
      return res.status(400).json({ error: 'No file uploaded' });
    }

    savedPath = req.file.path;
    const { originalname, size, filename } = req.file;

    const buffer = await fs.readFile(savedPath);

    let mime;
    let ext;
    try {
      ({ mime, ext } = validateFileBuffer(buffer));
    } catch (e) {
      await fs.unlink(savedPath).catch(() => {});
      if (e.code === 'UNSUPPORTED_MEDIA_TYPE') {
        console.log('[upload] rejected (not allowed type):', originalname, savedPath);
        logUpload('reject', { reason: 'unsupported_type', bytes: size });
        return res.status(415).json({ error: 'Unsupported media type' });
      }
      throw e;
    }

    const currentExt = path.extname(filename).toLowerCase();
    let finalFilename = filename;
    let finalPath = savedPath;
    if (ext && currentExt !== ext) {
      const dir = path.dirname(savedPath);
      const base = path.basename(filename, path.extname(filename));
      finalFilename = `${base}${ext}`;
      finalPath = path.join(dir, finalFilename);
      await fs.rename(savedPath, finalPath);
      savedPath = finalPath;
    }

    const publicUrl = buildPublicUploadUrl(req, finalFilename);
    const storageKey = path.relative(path.join(__dirname, '../..'), finalPath).replace(/\\/g, '/');

    await recordUpload({
      userId: req.user?.id,
      storageKey,
      mimeType: mime,
      sizeBytes: size,
      originalFilename: sanitizeFilename(originalname),
      publicUrl,
    });

    logUpload('success', {
      userId: req.user?.id,
      bytes: size,
      mime,
    });

    console.log('[upload] OK — validated & stored:', finalFilename, '|', mime, '|', finalPath, '| url:', publicUrl);

    return res.status(200).json({
      file_url: publicUrl,
      url: publicUrl,
      fileUrl: publicUrl,
    });
  } catch (err) {
    if (savedPath) await fs.unlink(savedPath).catch(() => {});
    logUpload('error', { message: err.message, code: err.code });
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
};
