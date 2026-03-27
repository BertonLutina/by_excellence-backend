const path = require('path');
const fs = require('fs');

const RESOLVED_UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
const UPLOAD_URL_PATH = '/uploads';

const ensureUploadDir = () => {
  if (!fs.existsSync(RESOLVED_UPLOAD_DIR)) fs.mkdirSync(RESOLVED_UPLOAD_DIR, { recursive: true });
};

exports.upload = async (req, res) => {
  try {
    ensureUploadDir();
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const apiBaseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${apiBaseUrl}${UPLOAD_URL_PATH}/${req.file.filename}`;
    res.json({ file_url: fileUrl, filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
