const path = require('path');
const fs = require('fs');
const { UPLOAD_DIR, API_BASE_URL } = require('../config/constant');

const RESOLVED_UPLOAD_DIR = UPLOAD_DIR || path.join(__dirname, '../uploads');
const UPLOAD_URL_PATH = '/uploads';

const ensureUploadDir = () => {
  if (!fs.existsSync(RESOLVED_UPLOAD_DIR)) fs.mkdirSync(RESOLVED_UPLOAD_DIR, { recursive: true });
};

exports.upload = async (req, res) => {
  try {
    ensureUploadDir();
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `${API_BASE_URL}${UPLOAD_URL_PATH}/${req.file.filename}`;
    res.json({ file_url: fileUrl, filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
