/**
 * Allowed types: MIME from magic bytes only (declared mimetype is not trusted).
 */
const ALLOWED = {
  'image/jpeg': { ext: '.jpg' },
  'image/png': { ext: '.png' },
  'image/webp': { ext: '.webp' },
  'application/pdf': { ext: '.pdf' },
};

function detectFromMagicBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }
  // JPEG (SOI = FF D8; next marker can vary)
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }
  // PNG
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' };
  }
  // WEBP (RIFF....WEBP)
  if (
    buffer.length >= 12 &&
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: '.webp' };
  }
  // PDF
  if (buffer.slice(0, 4).toString('ascii') === '%PDF') {
    return { mime: 'application/pdf', ext: '.pdf' };
  }
  return null;
}

/**
 * @returns {{ mime: string, ext: string }}
 */
function validateFileBuffer(buffer) {
  const detected = detectFromMagicBytes(buffer);
  if (!detected || !ALLOWED[detected.mime]) {
    const err = new Error('Unsupported file type');
    err.code = 'UNSUPPORTED_MEDIA_TYPE';
    throw err;
  }
  return { mime: detected.mime, ext: ALLOWED[detected.mime].ext };
}

module.exports = {
  ALLOWED_MIME_TYPES: Object.keys(ALLOWED),
  validateFileBuffer,
  detectFromMagicBytes,
};
