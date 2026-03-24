const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
const UPLOAD_URL_PATH = '/uploads';

const ensureUploadDir = () => {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
};

exports.upload = async (req, res) => {
  try {
    ensureUploadDir();
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
    const fileUrl = `${baseUrl}${UPLOAD_URL_PATH}/${req.file.filename}`;
    res.json({ file_url: fileUrl, filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
