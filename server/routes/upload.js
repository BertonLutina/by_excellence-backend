const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const uploadLimiter = require('../middleware/uploadRateLimit');
const ctrl = require('../controllers/uploadController');
const { MAX_UPLOAD_MB } = require('../../constants/constant');

const maxBytes = Math.max(1, MAX_UPLOAD_MB) * 1024 * 1024;

const uploadRoot = path.join(__dirname, '../../public/uploads');
try {
  fs.mkdirSync(uploadRoot, { recursive: true });
} catch {
  // mkdir best-effort; multer will fail if truly unusable
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadRoot);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '') || '';
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: maxBytes, files: 1 },
});

function handleMulter(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File too large' });
        }
        return res.status(400).json({ error: err.message || 'Invalid upload' });
      }
      return next(err);
    }
    if (req.file) {
      console.log('[upload] multer saved file:', req.file.filename, '→', req.file.path, `(${req.file.size} bytes)`);
    }
    next();
  });
}

router.post('/', authenticate, uploadLimiter, handleMulter, ctrl.upload);

module.exports = router;
