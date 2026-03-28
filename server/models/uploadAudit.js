const { executeSQL } = require('../db/db');

/**
 * Best-effort audit row; failures do not block the upload response.
 */
async function recordUpload({ userId, storageKey, mimeType, sizeBytes, originalFilename, publicUrl }) {
  try {
    await executeSQL(
      `INSERT INTO upload_audit (user_id, storage_key, mime_type, size_bytes, original_filename_sanitized, public_url)
       VALUES (?,?,?,?,?,?)`,
      [userId || null, storageKey, mimeType, sizeBytes, originalFilename || null, publicUrl]
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: 'upload.audit_insert_failed',
        error: err.message,
      })
    );
  }
}

module.exports = { recordUpload };
