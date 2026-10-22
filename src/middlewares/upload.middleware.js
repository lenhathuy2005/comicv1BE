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
ensureDir(path.join(uploadRoot, 'items'));
ensureDir(path.join(uploadRoot, 'guilds'));
ensureDir(path.join(uploadRoot, 'users'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'cover_image' || file.fieldname === 'banner_image') {
      return cb(null, path.join(uploadRoot, 'comics'));
    }

    if (file.fieldname === 'images' || file.fieldname === 'image') {
      return cb(null, path.join(uploadRoot, 'chapters'));
    }

    if (file.fieldname === 'icon_image' || file.fieldname === 'item_icon') {
      return cb(null, path.join(uploadRoot, 'items'));
    }

    if (file.fieldname === 'logo_image' || file.fieldname === 'guild_logo') {
      return cb(null, path.join(uploadRoot, 'guilds'));
    }

    if (file.fieldname === 'avatar_image' || file.fieldname === 'avatar') {
      return cb(null, path.join(uploadRoot, 'users'));
    }

    return cb(null, uploadRoot);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const allowedImageTypes = new Map([
  ['.jpg', new Set(['image/jpeg', 'image/jpg'])],
  ['.jpeg', new Set(['image/jpeg', 'image/jpg'])],
  ['.png', new Set(['image/png'])],
  ['.webp', new Set(['image/webp'])],
  ['.gif', new Set(['image/gif'])],
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!allowedImageTypes.get(ext)?.has(file.mimetype)) {
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
