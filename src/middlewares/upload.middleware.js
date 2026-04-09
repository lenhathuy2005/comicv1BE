const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadRoot = path.join(process.cwd(), 'uploads');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(uploadRoot);
ensureDir(path.join(uploadRoot, 'comics'));
ensureDir(path.join(uploadRoot, 'chapters'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'cover_image' || file.fieldname === 'banner_image') {
      return cb(null, path.join(uploadRoot, 'comics'));
    }

    if (file.fieldname === 'images') {
      return cb(null, path.join(uploadRoot, 'chapters'));
    }

    return cb(null, uploadRoot);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Chỉ chấp nhận file ảnh jpg, jpeg, png, webp, gif'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = upload;