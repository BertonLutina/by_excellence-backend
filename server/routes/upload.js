const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/uploadController');
const { UPLOAD_DIR } = require('../config/constant');

const configuredUploadDir = UPLOAD_DIR || path.join(__dirname, '../uploads');
let uploadDir = configuredUploadDir;
try {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
} catch (err) {
  // Fallback for environments where configured absolute path is unavailable.
  uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  console.warn(`[UPLOAD] Falling back to local upload dir because "${configuredUploadDir}" is not writable/creatable.`);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

router.post('/', authenticate, upload.single('file'), ctrl.upload);

module.exports = router;
