from pathlib import Path
root = Path('/mnt/data/backend_project')
files = {}
files['package.json'] = r'''
{
  "name": "comic-cultivation-backend",
  "version": "1.0.0",
  "description": "Backend Node.js + Express cho đồ án truyện tranh + tu luyện + AFK + guild + VIP",
  "main": "src/server.js",
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "lint": "echo 'No lint configured'",
    "check-db": "node src/scripts/checkDb.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.2",
    "express-validator": "^7.2.1",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "multer": "^1.4.5-lts.1",
    "mysql2": "^3.11.3",
    "nanoid": "^5.0.7"
  },
  "devDependencies": {
    "nodemon": "^3.1.7"
  }
}
'''
files['.env.example'] = r'''
PORT=3000
NODE_ENV=development
APP_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=comic_cultivation_system
DB_USER=root
DB_PASSWORD=
JWT_ACCESS_SECRET=change_this_access_secret
JWT_REFRESH_SECRET=change_this_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=10
'''
files['README.md'] = r'''
# Comic Cultivation Backend

Backend Node.js + Express bám theo schema `comic_cultivation_system.sql` mà bạn đã upload. Schema này đã có đầy đủ các nhóm bảng lớn như `users`, `roles`, `comics`, `chapters`, `chapter_images`, `guilds`, `guild_members`, `chat_rooms`, `chat_messages`, `user_cultivation`, `afk_sessions`, `items`, `shop_items`, `user_vip`, `vip_levels`, `payment_transactions`... fileciteturn2file6 fileciteturn2file18

## Tính năng backend đã scaffold
- Auth: register, login, me, refresh, logout, forgot password, reset password
- Users: list user, detail user, update status, profile tổng hợp
- Comics: list comic, detail comic, list chapter, create/update comic
- Guilds: list, detail, create guild, gửi request tham gia, duyệt request, donate, announcements
- VIP: list VIP levels, my vip, list benefits
- AFK: config, start session, finish session, claim session
- Shop: list items, list shop items, buy item
- Chat: list rooms, room messages, send message
- Notifications: list user notifications, mark read

## Lưu ý quan trọng
Schema bạn gửi hiện **chưa có bảng `auth_tokens`**, trong khi auth forgot/reset/refresh token cần nơi lưu token. Vì vậy project có kèm migration:
- `sql/001_add_auth_tokens.sql`

## Cách chạy
1. `npm install`
2. Copy `.env.example` thành `.env`
3. Import DB hiện tại của bạn
4. Chạy migration `sql/001_add_auth_tokens.sql`
5. `npm run dev`

## Response format
```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```
'''
files['sql/001_add_auth_tokens.sql'] = r'''
CREATE TABLE IF NOT EXISTS auth_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_type ENUM('verify_email','reset_password','refresh_token','session_token') NOT NULL,
  token_value VARCHAR(255) NOT NULL,
  expires_at DATETIME DEFAULT NULL,
  used_at DATETIME DEFAULT NULL,
  revoked_at DATETIME DEFAULT NULL,
  ip_address VARCHAR(64) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  meta_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(meta_json)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_tokens_value (token_value),
  KEY idx_auth_tokens_user_id (user_id),
  KEY idx_auth_tokens_type (token_type),
  KEY idx_auth_tokens_expires_at (expires_at),
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
'''
files['src/server.js'] = r'''
require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./config/database');

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
})();
'''
files['src/app.js'] = r'''
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/health', (_, res) => {
  res.json({ success: true, message: 'Backend is healthy' });
});

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
'''
files['src/routes.js'] = r'''
const express = require('express');
const authRoutes = require('./modules/auth/routes/auth.routes');
const userRoutes = require('./modules/users/routes/user.routes');
const comicRoutes = require('./modules/comics/routes/comic.routes');
const guildRoutes = require('./modules/guilds/routes/guild.routes');
const vipRoutes = require('./modules/vip/routes/vip.routes');
const afkRoutes = require('./modules/afk/routes/afk.routes');
const shopRoutes = require('./modules/shop/routes/shop.routes');
const chatRoutes = require('./modules/chat/routes/chat.routes');
const notificationRoutes = require('./modules/notifications/routes/notification.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/comics', comicRoutes);
router.use('/guilds', guildRoutes);
router.use('/vip', vipRoutes);
router.use('/afk', afkRoutes);
router.use('/shop', shopRoutes);
router.use('/chat', chatRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
'''
files['src/config/database.js'] = r'''
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  decimalNumbers: true,
});

async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    console.log('MySQL connected');
  } finally {
    conn.release();
  }
}

async function query(sql, params = {}) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { pool, query, transaction, testConnection };
'''
files['src/utils/apiResponse.js'] = r'''
class ApiResponse {
  static success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({ success: true, message, data });
  }

  static error(res, message = 'Error', statusCode = 500, errors = null) {
    return res.status(statusCode).json({ success: false, message, errors });
  }
}

module.exports = ApiResponse;
'''
files['src/utils/ApiError.js'] = r'''
class ApiError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

module.exports = ApiError;
'''
files['src/utils/asyncHandler.js'] = r'''
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
'''
files['src/utils/password.util.js'] = r'''
const bcrypt = require('bcryptjs');

async function hashPassword(plainPassword) {
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  return bcrypt.hash(plainPassword, rounds);
}

async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

module.exports = { hashPassword, comparePassword };
'''
files['src/utils/token.util.js'] = r'''
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function signRefreshJwt(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
}

function verifyRefreshJwt(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

function generateOpaqueToken(prefix = 'tok') {
  return `${prefix}_${nanoid(48)}`;
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshJwt,
  verifyRefreshJwt,
  generateOpaqueToken,
};
'''
files['src/middlewares/error.middleware.js'] = r'''
const ApiError = require('../utils/ApiError');

function notFoundHandler(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
}

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const errors = err.errors || null;
  return res.status(statusCode).json({ success: false, message, errors });
}

module.exports = { notFoundHandler, errorHandler };
'''
files['src/middlewares/auth.middleware.js'] = r'''
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/token.util');
const { query } = require('../config/database');

const requireAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    throw new ApiError(401, 'Unauthorized');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw new ApiError(401, 'Invalid access token');
  }

  const users = await query(
    `SELECT u.id, u.role_id, u.username, u.email, u.display_name,
            COALESCE(r.code, 'user') AS role_code,
            u.account_status, u.is_verified, u.is_email_verified
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = :id AND u.deleted_at IS NULL
     LIMIT 1`,
    { id: decoded.sub }
  );

  if (!users.length) {
    throw new ApiError(401, 'User not found');
  }

  req.user = users[0];
  next();
});

const requireRole = (...roles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Unauthorized'));
    }
    if (!roles.includes(req.user.role_code)) {
      return next(new ApiError(403, 'Forbidden'));
    }
    next();
  };
};

module.exports = { requireAuth, requireRole };
'''
files['src/middlewares/validate.middleware.js'] = r'''
const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

module.exports = function validate(req, _res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return next(new ApiError(422, 'Validation failed', result.array()));
  }
  next();
};
'''
# auth
files['src/modules/auth/validators/auth.validator.js'] = r'''
const { body } = require('express-validator');

const registerValidator = [
  body('username').trim().isLength({ min: 3, max: 50 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6, max: 100 }),
  body('displayName').optional().isLength({ min: 2, max: 100 }),
];

const loginValidator = [
  body('identifier').notEmpty(),
  body('password').notEmpty(),
];

const forgotPasswordValidator = [body('email').isEmail()];
const resetPasswordValidator = [body('token').notEmpty(), body('newPassword').isLength({ min: 6, max: 100 })];
const refreshValidator = [body('refreshToken').notEmpty()];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  refreshValidator,
};
'''
files['src/modules/auth/services/auth.service.js'] = r'''
const { query, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');
const { hashPassword, comparePassword } = require('../../../utils/password.util');
const { signAccessToken, signRefreshJwt, verifyRefreshJwt, generateOpaqueToken } = require('../../../utils/token.util');

async function findRoleIdByCode(roleCode = 'user') {
  const rows = await query('SELECT id FROM roles WHERE code = :code LIMIT 1', { code: roleCode });
  if (!rows.length) throw new ApiError(500, `Role ${roleCode} not found`);
  return rows[0].id;
}

async function findUserByIdentifier(identifier) {
  const rows = await query(
    `SELECT u.*, r.code AS role_code
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE (u.username = :identifier OR u.email = :identifier)
       AND u.deleted_at IS NULL
     LIMIT 1`,
    { identifier }
  );
  return rows[0] || null;
}

async function storeAuthToken(conn, payload) {
  const sql = `INSERT INTO auth_tokens
    (user_id, token_type, token_value, expires_at, ip_address, user_agent, meta_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const [result] = await conn.execute(sql, [
    payload.userId,
    payload.tokenType,
    payload.tokenValue,
    payload.expiresAt || null,
    payload.ipAddress || null,
    payload.userAgent || null,
    payload.metaJson ? JSON.stringify(payload.metaJson) : null,
  ]);
  return result.insertId;
}

async function register(data, context = {}) {
  return transaction(async (conn) => {
    const existing = await query(
      'SELECT id FROM users WHERE (username = :username OR email = :email) AND deleted_at IS NULL LIMIT 1',
      { username: data.username, email: data.email }
    );
    if (existing.length) throw new ApiError(409, 'Username hoặc email đã tồn tại');

    const userRoleId = await findRoleIdByCode('user');
    const passwordHash = await hashPassword(data.password);

    const [userResult] = await conn.execute(
      `INSERT INTO users (role_id, username, email, password_hash, display_name, account_status, is_verified, is_email_verified)
       VALUES (?, ?, ?, ?, ?, 'active', 0, 0)`,
      [userRoleId, data.username, data.email, passwordHash, data.displayName || data.username]
    );

    const userId = userResult.insertId;

    await conn.execute(
      `INSERT INTO user_profiles (user_id, full_name, gold_balance, premium_currency, energy, stamina, power_score)
       VALUES (?, ?, 0, 0, 100, 100, 0)`,
      [userId, data.displayName || data.username]
    );

    const levels = await query('SELECT id FROM levels ORDER BY level_number ASC LIMIT 1');
    const realms = await query('SELECT id FROM realms ORDER BY realm_order ASC LIMIT 1');
    const vipLevels = await query('SELECT id FROM vip_levels ORDER BY level_number ASC LIMIT 1');

    if (levels.length && realms.length) {
      await conn.execute(
        `INSERT INTO user_cultivation (user_id, current_level_id, current_realm_id, current_exp, total_exp_earned, combat_power)
         VALUES (?, ?, ?, 0, 0, 0)`,
        [userId, levels[0].id, realms[0].id]
      );
    }

    if (vipLevels.length) {
      await conn.execute(
        `INSERT INTO user_vip (user_id, current_vip_level_id, total_topup_amount, vip_exp)
         VALUES (?, ?, 0, 0)`,
        [userId, vipLevels[0].id]
      );
    }

    const verifyToken = generateOpaqueToken('verify');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await storeAuthToken(conn, {
      userId,
      tokenType: 'verify_email',
      tokenValue: verifyToken,
      expiresAt,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metaJson: { email: data.email },
    });

    return {
      userId,
      verifyToken,
      message: 'Đăng ký thành công',
    };
  });
}

async function login(data, context = {}) {
  return transaction(async (conn) => {
    const user = await findUserByIdentifier(data.identifier);
    if (!user) throw new ApiError(401, 'Sai tài khoản hoặc mật khẩu');
    if (['banned', 'suspended'].includes(user.account_status)) {
      throw new ApiError(403, 'Tài khoản đang bị khóa');
    }

    const isMatch = await comparePassword(data.password, user.password_hash);
    if (!isMatch) throw new ApiError(401, 'Sai tài khoản hoặc mật khẩu');

    const accessToken = signAccessToken({ sub: user.id, role: user.role_code });
    const refreshJwt = signRefreshJwt({ sub: user.id, role: user.role_code });
    const sessionToken = generateOpaqueToken('sess');

    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await storeAuthToken(conn, {
      userId: user.id,
      tokenType: 'refresh_token',
      tokenValue: refreshJwt,
      expiresAt: refreshExpiresAt,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    await storeAuthToken(conn, {
      userId: user.id,
      tokenType: 'session_token',
      tokenValue: sessionToken,
      expiresAt: sessionExpiresAt,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    await conn.execute(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?',
      [context.ipAddress || null, user.id]
    );

    return {
      accessToken,
      refreshToken: refreshJwt,
      sessionToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        roleCode: user.role_code,
      },
    };
  });
}

async function getCurrentUser(userId) {
  const rows = await query(
    `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.account_status,
            u.is_verified, u.is_email_verified, u.last_login_at,
            r.code AS role_code, r.name AS role_name,
            up.gold_balance, up.premium_currency, up.power_score,
            uc.current_exp, uc.total_exp_earned, uc.combat_power,
            rl.name AS realm_name, lv.level_number,
            uv.total_topup_amount, uv.vip_exp, vl.level_number AS vip_level_number, vl.name AS vip_level_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN user_cultivation uc ON uc.user_id = u.id
     LEFT JOIN realms rl ON rl.id = uc.current_realm_id
     LEFT JOIN levels lv ON lv.id = uc.current_level_id
     LEFT JOIN user_vip uv ON uv.user_id = u.id
     LEFT JOIN vip_levels vl ON vl.id = uv.current_vip_level_id
     WHERE u.id = :userId
     LIMIT 1`,
    { userId }
  );
  if (!rows.length) throw new ApiError(404, 'User not found');
  return rows[0];
}

async function forgotPassword(email, context = {}) {
  return transaction(async (conn) => {
    const users = await query('SELECT id, email FROM users WHERE email = :email AND deleted_at IS NULL LIMIT 1', { email });
    if (!users.length) return { message: 'Nếu email tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu' };
    const user = users[0];

    await conn.execute(
      `UPDATE auth_tokens SET revoked_at = NOW()
       WHERE user_id = ? AND token_type = 'reset_password' AND used_at IS NULL AND revoked_at IS NULL`,
      [user.id]
    );

    const resetToken = generateOpaqueToken('reset');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await storeAuthToken(conn, {
      userId: user.id,
      tokenType: 'reset_password',
      tokenValue: resetToken,
      expiresAt,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      message: 'Nếu email tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu',
      debugResetToken: resetToken,
    };
  });
}

async function resetPassword(token, newPassword) {
  return transaction(async (conn) => {
    const tokens = await query(
      `SELECT * FROM auth_tokens
       WHERE token_value = :token
         AND token_type = 'reset_password'
         AND used_at IS NULL
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      { token }
    );
    if (!tokens.length) throw new ApiError(400, 'Reset token không hợp lệ hoặc đã hết hạn');
    const tokenRow = tokens[0];
    const passwordHash = await hashPassword(newPassword);

    await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, tokenRow.user_id]);
    await conn.execute('UPDATE auth_tokens SET used_at = NOW() WHERE id = ?', [tokenRow.id]);
    await conn.execute(
      `UPDATE auth_tokens SET revoked_at = NOW()
       WHERE user_id = ? AND token_type IN ('refresh_token', 'session_token') AND revoked_at IS NULL`,
      [tokenRow.user_id]
    );

    return { message: 'Đặt lại mật khẩu thành công' };
  });
}

async function refreshToken(refreshToken, context = {}) {
  return transaction(async (conn) => {
    try {
      verifyRefreshJwt(refreshToken);
    } catch {
      throw new ApiError(401, 'Refresh token JWT không hợp lệ');
    }

    const tokenRows = await query(
      `SELECT * FROM auth_tokens
       WHERE token_value = :refreshToken
         AND token_type = 'refresh_token'
         AND revoked_at IS NULL
         AND used_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      { refreshToken }
    );

    if (!tokenRows.length) throw new ApiError(401, 'Refresh token không hợp lệ hoặc đã hết hạn');
    const storedToken = tokenRows[0];
    const userRows = await query(
      `SELECT u.id, r.code AS role_code
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = :id LIMIT 1`,
      { id: storedToken.user_id }
    );
    if (!userRows.length) throw new ApiError(404, 'User not found');
    const user = userRows[0];

    const newAccessToken = signAccessToken({ sub: user.id, role: user.role_code });
    const newRefreshToken = signRefreshJwt({ sub: user.id, role: user.role_code });

    await conn.execute('UPDATE auth_tokens SET revoked_at = NOW() WHERE id = ?', [storedToken.id]);
    await storeAuthToken(conn, {
      userId: user.id,
      tokenType: 'refresh_token',
      tokenValue: newRefreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  });
}

async function logout(userId, tokenValue) {
  await query(
    `UPDATE auth_tokens SET revoked_at = NOW()
     WHERE user_id = :userId AND token_value = :tokenValue AND revoked_at IS NULL`,
    { userId, tokenValue }
  );
  return { message: 'Đăng xuất thành công' };
}

module.exports = {
  register,
  login,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
};
'''
files['src/modules/auth/controllers/auth.controller.js'] = r'''
const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const authService = require('../services/auth.service');

function clientContext(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

exports.register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body, clientContext(req));
  return ApiResponse.success(res, data, 'Đăng ký thành công', 201);
});

exports.login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body, clientContext(req));
  return ApiResponse.success(res, data, 'Đăng nhập thành công');
});

exports.me = asyncHandler(async (req, res) => {
  const data = await authService.getCurrentUser(req.user.id);
  return ApiResponse.success(res, data, 'Lấy thông tin cá nhân thành công');
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const data = await authService.forgotPassword(req.body.email, clientContext(req));
  return ApiResponse.success(res, data, 'Yêu cầu quên mật khẩu đã được ghi nhận');
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const data = await authService.resetPassword(req.body.token, req.body.newPassword);
  return ApiResponse.success(res, data, 'Đặt lại mật khẩu thành công');
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
  const data = await authService.refreshToken(refreshToken, clientContext(req));
  return ApiResponse.success(res, data, 'Làm mới token thành công');
});

exports.logout = asyncHandler(async (req, res) => {
  const tokenValue = req.body.tokenValue;
  const data = await authService.logout(req.user.id, tokenValue);
  return ApiResponse.success(res, data, 'Đăng xuất thành công');
});
'''
files['src/modules/auth/routes/auth.routes.js'] = r'''
const express = require('express');
const controller = require('../controllers/auth.controller');
const validate = require('../../../middlewares/validate.middleware');
const { requireAuth } = require('../../../middlewares/auth.middleware');
const { registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator, refreshValidator } = require('../validators/auth.validator');

const router = express.Router();

router.post('/register', registerValidator, validate, controller.register);
router.post('/login', loginValidator, validate, controller.login);
router.get('/me', requireAuth, controller.me);
router.post('/forgot-password', forgotPasswordValidator, validate, controller.forgotPassword);
router.post('/reset-password', resetPasswordValidator, validate, controller.resetPassword);
router.post('/refresh-token', refreshValidator, validate, controller.refreshToken);
router.post('/logout', requireAuth, controller.logout);

module.exports = router;
'''
# users
files['src/modules/users/services/user.service.js'] = r'''
const { query, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

async function listUsers(filters) {
  const page = Number(filters.page || 1);
  const limit = Number(filters.limit || 20);
  const offset = (page - 1) * limit;

  const rows = await query(
    `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url,
            u.account_status, u.created_at, u.last_login_at,
            r.code AS role_code, r.name AS role_name,
            up.gold_balance, up.premium_currency, up.power_score,
            uc.current_exp, uc.combat_power,
            rl.name AS realm_name, lv.level_number,
            vl.level_number AS vip_level_number, vl.name AS vip_level_name,
            g.name AS guild_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN user_cultivation uc ON uc.user_id = u.id
     LEFT JOIN realms rl ON rl.id = uc.current_realm_id
     LEFT JOIN levels lv ON lv.id = uc.current_level_id
     LEFT JOIN user_vip uv ON uv.user_id = u.id
     LEFT JOIN vip_levels vl ON vl.id = uv.current_vip_level_id
     LEFT JOIN guilds g ON g.id = u.current_guild_id
     WHERE (:keyword IS NULL OR u.username LIKE CONCAT('%', :keyword, '%') OR u.email LIKE CONCAT('%', :keyword, '%') OR u.display_name LIKE CONCAT('%', :keyword, '%'))
       AND (:status IS NULL OR u.account_status = :status)
       AND u.deleted_at IS NULL
     ORDER BY u.id DESC
     LIMIT :limit OFFSET :offset`,
    {
      keyword: filters.keyword || null,
      status: filters.status || null,
      limit,
      offset,
    }
  );

  return { page, limit, items: rows };
}

async function getUserDetail(userId) {
  const rows = await query(
    `SELECT u.*, r.code AS role_code, r.name AS role_name,
            up.full_name, up.phone_number, up.gender, up.birth_date, up.bio, up.country,
            up.gold_balance, up.premium_currency, up.energy, up.stamina, up.power_score, up.current_title,
            uc.current_exp, uc.total_exp_earned, uc.breakthrough_count, uc.spirit_stones, uc.reputation_points, uc.combat_power,
            rl.name AS realm_name, lv.level_number,
            uv.total_topup_amount, uv.vip_exp, vl.level_number AS vip_level_number, vl.name AS vip_level_name,
            g.name AS guild_name, g.slug AS guild_slug
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN user_cultivation uc ON uc.user_id = u.id
     LEFT JOIN realms rl ON rl.id = uc.current_realm_id
     LEFT JOIN levels lv ON lv.id = uc.current_level_id
     LEFT JOIN user_vip uv ON uv.user_id = u.id
     LEFT JOIN vip_levels vl ON vl.id = uv.current_vip_level_id
     LEFT JOIN guilds g ON g.id = u.current_guild_id
     WHERE u.id = :userId AND u.deleted_at IS NULL
     LIMIT 1`,
    { userId }
  );
  if (!rows.length) throw new ApiError(404, 'User not found');
  return rows[0];
}

async function updateUserStatus(userId, payload, actorUserId) {
  return transaction(async (conn) => {
    const users = await query('SELECT id, account_status FROM users WHERE id = :userId LIMIT 1', { userId });
    if (!users.length) throw new ApiError(404, 'User not found');
    const user = users[0];

    await conn.execute('UPDATE users SET account_status = ? WHERE id = ?', [payload.newStatus, userId]);
    await conn.execute(
      `INSERT INTO user_status_logs (user_id, old_status, new_status, reason, changed_by_user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, user.account_status, payload.newStatus, payload.reason || null, actorUserId || null]
    );

    return { userId, oldStatus: user.account_status, newStatus: payload.newStatus };
  });
}

module.exports = { listUsers, getUserDetail, updateUserStatus };
'''
files['src/modules/users/controllers/user.controller.js'] = r'''
const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const userService = require('../services/user.service');

exports.listUsers = asyncHandler(async (req, res) => {
  const data = await userService.listUsers(req.query);
  return ApiResponse.success(res, data, 'Lấy danh sách user thành công');
});

exports.getUserDetail = asyncHandler(async (req, res) => {
  const data = await userService.getUserDetail(req.params.id);
  return ApiResponse.success(res, data, 'Lấy chi tiết user thành công');
});

exports.updateUserStatus = asyncHandler(async (req, res) => {
  const data = await userService.updateUserStatus(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, data, 'Cập nhật trạng thái user thành công');
});
'''
files['src/modules/users/routes/user.routes.js'] = r'''
const express = require('express');
const controller = require('../controllers/user.controller');
const { requireAuth, requireRole } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), controller.listUsers);
router.get('/:id', requireAuth, controller.getUserDetail);
router.patch('/:id/status', requireAuth, requireRole('admin'), controller.updateUserStatus);

module.exports = router;
'''
# comics
files['src/modules/comics/services/comic.service.js'] = r'''
const { query, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

async function listComics(filters) {
  const page = Number(filters.page || 1);
  const limit = Number(filters.limit || 20);
  const offset = (page - 1) * limit;

  const rows = await query(
    `SELECT c.id, c.title, c.slug, c.cover_image_url, c.banner_image_url, c.summary,
            c.publication_status, c.visibility_status, c.age_rating, c.total_views, c.total_follows,
            c.created_at, c.updated_at,
            a.name AS author_name,
            COUNT(DISTINCT ch.id) AS total_chapters,
            GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR ', ') AS genres
     FROM comics c
     LEFT JOIN authors a ON a.id = c.author_id
     LEFT JOIN chapters ch ON ch.comic_id = c.id AND ch.deleted_at IS NULL
     LEFT JOIN comic_genres cg ON cg.comic_id = c.id
     LEFT JOIN genres g ON g.id = cg.genre_id
     WHERE (:keyword IS NULL OR c.title LIKE CONCAT('%', :keyword, '%') OR c.slug LIKE CONCAT('%', :keyword, '%'))
       AND (:publicationStatus IS NULL OR c.publication_status = :publicationStatus)
       AND c.deleted_at IS NULL
     GROUP BY c.id
     ORDER BY c.id DESC
     LIMIT :limit OFFSET :offset`,
    {
      keyword: filters.keyword || null,
      publicationStatus: filters.publicationStatus || null,
      limit,
      offset,
    }
  );
  return { page, limit, items: rows };
}

async function getComicDetail(comicId) {
  const rows = await query(
    `SELECT c.*, a.name AS author_name,
            GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR ', ') AS genres
     FROM comics c
     LEFT JOIN authors a ON a.id = c.author_id
     LEFT JOIN comic_genres cg ON cg.comic_id = c.id
     LEFT JOIN genres g ON g.id = cg.genre_id
     WHERE c.id = :comicId AND c.deleted_at IS NULL
     GROUP BY c.id
     LIMIT 1`,
    { comicId }
  );
  if (!rows.length) throw new ApiError(404, 'Comic not found');

  const chapters = await query(
    `SELECT id, chapter_number, title, slug, access_type, publish_status, view_count, released_at
     FROM chapters
     WHERE comic_id = :comicId AND deleted_at IS NULL
     ORDER BY chapter_number DESC`,
    { comicId }
  );

  return { ...rows[0], chapters };
}

async function createComic(payload, actorUserId) {
  return transaction(async (conn) => {
    const [result] = await conn.execute(
      `INSERT INTO comics (author_id, title, slug, cover_image_url, banner_image_url, summary, publication_status, visibility_status, age_rating, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.authorId || null,
        payload.title,
        payload.slug,
        payload.coverImageUrl || null,
        payload.bannerImageUrl || null,
        payload.summary || null,
        payload.publicationStatus || 'draft',
        payload.visibilityStatus || 'public',
        payload.ageRating || 'all',
        actorUserId || null,
      ]
    );

    if (Array.isArray(payload.genreIds) && payload.genreIds.length) {
      const values = payload.genreIds.map((genreId) => [result.insertId, genreId]);
      await conn.query('INSERT INTO comic_genres (comic_id, genre_id) VALUES ?', [values]);
    }

    return { id: result.insertId };
  });
}

async function updateComic(comicId, payload) {
  return transaction(async (conn) => {
    await conn.execute(
      `UPDATE comics
       SET author_id = ?, title = ?, slug = ?, cover_image_url = ?, banner_image_url = ?, summary = ?,
           publication_status = ?, visibility_status = ?, age_rating = ?
       WHERE id = ?`,
      [
        payload.authorId || null,
        payload.title,
        payload.slug,
        payload.coverImageUrl || null,
        payload.bannerImageUrl || null,
        payload.summary || null,
        payload.publicationStatus || 'draft',
        payload.visibilityStatus || 'public',
        payload.ageRating || 'all',
        comicId,
      ]
    );

    if (Array.isArray(payload.genreIds)) {
      await conn.execute('DELETE FROM comic_genres WHERE comic_id = ?', [comicId]);
      if (payload.genreIds.length) {
        const values = payload.genreIds.map((genreId) => [comicId, genreId]);
        await conn.query('INSERT INTO comic_genres (comic_id, genre_id) VALUES ?', [values]);
      }
    }
    return { id: Number(comicId) };
  });
}

async function listChapterImages(chapterId) {
  return query(
    `SELECT id, image_url, display_order
     FROM chapter_images
     WHERE chapter_id = :chapterId
     ORDER BY display_order ASC`,
    { chapterId }
  );
}

module.exports = {
  listComics,
  getComicDetail,
  createComic,
  updateComic,
  listChapterImages,
};
'''
files['src/modules/comics/controllers/comic.controller.js'] = r'''
const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const comicService = require('../services/comic.service');

exports.listComics = asyncHandler(async (req, res) => {
  const data = await comicService.listComics(req.query);
  return ApiResponse.success(res, data, 'Lấy danh sách truyện thành công');
});

exports.getComicDetail = asyncHandler(async (req, res) => {
  const data = await comicService.getComicDetail(req.params.id);
  return ApiResponse.success(res, data, 'Lấy chi tiết truyện thành công');
});

exports.createComic = asyncHandler(async (req, res) => {
  const data = await comicService.createComic(req.body, req.user.id);
  return ApiResponse.success(res, data, 'Tạo truyện thành công', 201);
});

exports.updateComic = asyncHandler(async (req, res) => {
  const data = await comicService.updateComic(req.params.id, req.body);
  return ApiResponse.success(res, data, 'Cập nhật truyện thành công');
});
'''
files['src/modules/comics/routes/comic.routes.js'] = r'''
const express = require('express');
const controller = require('../controllers/comic.controller');
const { requireAuth, requireRole } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/', controller.listComics);
router.get('/:id', controller.getComicDetail);
router.post('/', requireAuth, requireRole('admin'), controller.createComic);
router.put('/:id', requireAuth, requireRole('admin'), controller.updateComic);

module.exports = router;
'''
# guilds
files['src/modules/guilds/services/guild.service.js'] = r'''
const { query, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

async function listGuilds() {
  return query(
    `SELECT g.id, g.name, g.slug, g.logo_url, g.description, g.announcement,
            g.member_limit, g.level, g.contribution_points, g.guild_power, g.guild_status,
            leader.display_name AS leader_name,
            COUNT(gm.id) AS active_member_count
     FROM guilds g
     LEFT JOIN users leader ON leader.id = g.leader_user_id
     LEFT JOIN guild_members gm ON gm.guild_id = g.id AND gm.join_status = 'active'
     GROUP BY g.id
     ORDER BY g.guild_power DESC, g.id DESC`
  );
}

async function getGuildDetail(guildId) {
  const rows = await query(
    `SELECT g.*, leader.display_name AS leader_name
     FROM guilds g
     LEFT JOIN users leader ON leader.id = g.leader_user_id
     WHERE g.id = :guildId
     LIMIT 1`,
    { guildId }
  );
  if (!rows.length) throw new ApiError(404, 'Guild not found');

  const members = await query(
    `SELECT gm.id, gm.join_status, gm.contribution_points, gm.joined_at,
            u.id AS user_id, u.username, u.display_name, u.avatar_url,
            gr.code AS guild_role_code, gr.name AS guild_role_name, gr.hierarchy_level
     FROM guild_members gm
     JOIN users u ON u.id = gm.user_id
     JOIN guild_roles gr ON gr.id = gm.guild_role_id
     WHERE gm.guild_id = :guildId
     ORDER BY gr.hierarchy_level ASC, gm.joined_at ASC`,
    { guildId }
  );

  const announcements = await query(
    `SELECT ga.*, u.display_name AS posted_by_display_name
     FROM guild_announcements ga
     JOIN users u ON u.id = ga.posted_by_user_id
     WHERE ga.guild_id = :guildId
     ORDER BY ga.created_at DESC`,
    { guildId }
  );

  return { ...rows[0], members, announcements };
}

async function createGuild(payload, leaderUserId) {
  return transaction(async (conn) => {
    const guildRoleRows = await query('SELECT id FROM guild_roles ORDER BY hierarchy_level ASC LIMIT 1');
    if (!guildRoleRows.length) throw new ApiError(500, 'Guild roles chưa có dữ liệu');
    const leaderRoleId = guildRoleRows[0].id;

    const [guildResult] = await conn.execute(
      `INSERT INTO guilds (name, slug, logo_url, description, announcement, leader_user_id, member_limit, level, guild_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active')`,
      [payload.name, payload.slug, payload.logoUrl || null, payload.description || null, payload.announcement || null, leaderUserId, payload.memberLimit || 30]
    );

    await conn.execute(
      `INSERT INTO guild_members (guild_id, user_id, guild_role_id, join_status, contribution_points)
       VALUES (?, ?, ?, 'active', 0)`,
      [guildResult.insertId, leaderUserId, leaderRoleId]
    );

    await conn.execute('UPDATE users SET current_guild_id = ? WHERE id = ?', [guildResult.insertId, leaderUserId]);
    await conn.execute(
      `INSERT INTO guild_logs (guild_id, user_id, action_type, details)
       VALUES (?, ?, 'create', ?)`,
      [guildResult.insertId, leaderUserId, `Tạo bang ${payload.name}`]
    );

    return { id: guildResult.insertId };
  });
}

async function requestJoinGuild(guildId, userId, requestMessage) {
  return transaction(async (conn) => {
    const existingMember = await query(
      `SELECT id FROM guild_members WHERE user_id = :userId AND join_status = 'active' LIMIT 1`,
      { userId }
    );
    if (existingMember.length) throw new ApiError(400, 'User đang thuộc bang khác');

    const existingPending = await query(
      `SELECT id FROM guild_join_requests WHERE guild_id = :guildId AND user_id = :userId AND request_status = 'pending' LIMIT 1`,
      { guildId, userId }
    );
    if (existingPending.length) throw new ApiError(409, 'Đã có đơn xin tham gia đang chờ duyệt');

    const [result] = await conn.execute(
      `INSERT INTO guild_join_requests (guild_id, user_id, request_message, request_status)
       VALUES (?, ?, ?, 'pending')`,
      [guildId, userId, requestMessage || null]
    );
    return { id: result.insertId };
  });
}

async function approveJoinRequest(requestId, actorUserId) {
  return transaction(async (conn) => {
    const requests = await query(
      `SELECT * FROM guild_join_requests WHERE id = :requestId LIMIT 1`,
      { requestId }
    );
    if (!requests.length) throw new ApiError(404, 'Join request not found');
    const request = requests[0];
    if (request.request_status !== 'pending') throw new ApiError(400, 'Request không ở trạng thái chờ');

    const memberRoleRows = await query(
      `SELECT id FROM guild_roles ORDER BY hierarchy_level DESC LIMIT 1`
    );
    if (!memberRoleRows.length) throw new ApiError(500, 'Guild roles chưa có dữ liệu');
    const defaultRoleId = memberRoleRows[0].id;

    await conn.execute(
      `UPDATE guild_join_requests
       SET request_status = 'approved', reviewed_by_user_id = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [actorUserId, requestId]
    );

    await conn.execute(
      `INSERT INTO guild_members (guild_id, user_id, guild_role_id, join_status, contribution_points)
       VALUES (?, ?, ?, 'active', 0)`,
      [request.guild_id, request.user_id, defaultRoleId]
    );

    await conn.execute('UPDATE users SET current_guild_id = ? WHERE id = ?', [request.guild_id, request.user_id]);
    await conn.execute(
      `INSERT INTO guild_logs (guild_id, user_id, action_type, target_user_id, details)
       VALUES (?, ?, 'approve_join', ?, 'Duyệt đơn xin vào bang')`,
      [request.guild_id, actorUserId, request.user_id]
    );

    return { requestId, status: 'approved' };
  });
}

async function donateToGuild(guildId, userId, payload) {
  return transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO guild_donations (guild_id, user_id, donation_type, item_id, quantity, amount, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [guildId, userId, payload.donationType, payload.itemId || null, payload.quantity || 0, payload.amount || 0, payload.note || null]
    );

    await conn.execute(
      `UPDATE guild_members
       SET contribution_points = contribution_points + ?
       WHERE guild_id = ? AND user_id = ? AND join_status = 'active'`,
      [payload.quantity || payload.amount || 0, guildId, userId]
    );

    await conn.execute(
      `UPDATE guilds
       SET contribution_points = contribution_points + ?
       WHERE id = ?`,
      [payload.quantity || payload.amount || 0, guildId]
    );

    await conn.execute(
      `INSERT INTO guild_logs (guild_id, user_id, action_type, details)
       VALUES (?, ?, 'donate', ?)`,
      [guildId, userId, 'Donate cho bang']
    );

    return { message: 'Donate thành công' };
  });
}

module.exports = { listGuilds, getGuildDetail, createGuild, requestJoinGuild, approveJoinRequest, donateToGuild };
'''
files['src/modules/guilds/controllers/guild.controller.js'] = r'''
const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const guildService = require('../services/guild.service');

exports.listGuilds = asyncHandler(async (_req, res) => {
  const data = await guildService.listGuilds();
  return ApiResponse.success(res, data, 'Lấy danh sách bang thành công');
});

exports.getGuildDetail = asyncHandler(async (req, res) => {
  const data = await guildService.getGuildDetail(req.params.id);
  return ApiResponse.success(res, data, 'Lấy chi tiết bang thành công');
});

exports.createGuild = asyncHandler(async (req, res) => {
  const data = await guildService.createGuild(req.body, req.user.id);
  return ApiResponse.success(res, data, 'Tạo bang thành công', 201);
});

exports.requestJoinGuild = asyncHandler(async (req, res) => {
  const data = await guildService.requestJoinGuild(req.params.id, req.user.id, req.body.requestMessage);
  return ApiResponse.success(res, data, 'Gửi đơn xin gia nhập bang thành công', 201);
});

exports.approveJoinRequest = asyncHandler(async (req, res) => {
  const data = await guildService.approveJoinRequest(req.params.requestId, req.user.id);
  return ApiResponse.success(res, data, 'Duyệt đơn xin vào bang thành công');
});

exports.donateToGuild = asyncHandler(async (req, res) => {
  const data = await guildService.donateToGuild(req.params.id, req.user.id, req.body);
  return ApiResponse.success(res, data, 'Donate bang thành công');
});
'''
files['src/modules/guilds/routes/guild.routes.js'] = r'''
const express = require('express');
const controller = require('../controllers/guild.controller');
const { requireAuth, requireRole } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/', controller.listGuilds);
router.get('/:id', controller.getGuildDetail);
router.post('/', requireAuth, controller.createGuild);
router.post('/:id/join-requests', requireAuth, controller.requestJoinGuild);
router.post('/join-requests/:requestId/approve', requireAuth, requireRole('admin', 'user'), controller.approveJoinRequest);
router.post('/:id/donations', requireAuth, controller.donateToGuild);

module.exports = router;
'''
# vip
files['src/modules/vip/services/vip.service.js'] = r'''
const { query } = require('../../../config/database');

async function listVipLevels() {
  const levels = await query('SELECT * FROM vip_levels ORDER BY level_number ASC');
  for (const level of levels) {
    level.benefits = await query(
      'SELECT benefit_code, benefit_name, benefit_value, description FROM vip_benefits WHERE vip_level_id = :vipLevelId',
      { vipLevelId: level.id }
    );
  }
  return levels;
}

async function myVip(userId) {
  const rows = await query(
    `SELECT uv.*, vl.level_number, vl.name, vl.required_topup_amount, vl.badge_name, vl.badge_color, vl.description
     FROM user_vip uv
     JOIN vip_levels vl ON vl.id = uv.current_vip_level_id
     WHERE uv.user_id = :userId
     LIMIT 1`,
    { userId }
  );
  return rows[0] || null;
}

async function listFeatureUnlocks() {
  return query(
    `SELECT vfu.*, vl.level_number, vl.name AS vip_level_name
     FROM vip_feature_unlocks vfu
     JOIN vip_levels vl ON vl.id = vfu.required_vip_level_id
     ORDER BY vl.level_number ASC, vfu.feature_code ASC`
  );
}

module.exports = { listVipLevels, myVip, listFeatureUnlocks };
'''
files['src/modules/vip/controllers/vip.controller.js'] = r'''
const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const vipService = require('../services/vip.service');

exports.listVipLevels = asyncHandler(async (_req, res) => {
  const data = await vipService.listVipLevels();
  return ApiResponse.success(res, data, 'Lấy danh sách VIP level thành công');
});

exports.myVip = asyncHandler(async (req, res) => {
  const data = await vipService.myVip(req.user.id);
  return ApiResponse.success(res, data, 'Lấy thông tin VIP của user thành công');
});

exports.listFeatureUnlocks = asyncHandler(async (_req, res) => {
  const data = await vipService.listFeatureUnlocks();
  return ApiResponse.success(res, data, 'Lấy danh sách feature unlock theo VIP thành công');
});
'''
files['src/modules/vip/routes/vip.routes.js'] = r'''
const express = require('express');
const controller = require('../controllers/vip.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/levels', controller.listVipLevels);
router.get('/features', controller.listFeatureUnlocks);
router.get('/me', requireAuth, controller.myVip);

module.exports = router;
'''
# afk
files['src/modules/afk/services/afk.service.js'] = r'''
const { query, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

async function listConfigs() {
  return query('SELECT * FROM afk_configs ORDER BY id ASC');
}

async function getRunningSession(userId) {
  const rows = await query(
    `SELECT * FROM afk_sessions WHERE user_id = :userId AND session_status = 'running' LIMIT 1`,
    { userId }
  );
  return rows[0] || null;
}

async function startSession(userId) {
  return transaction(async (conn) => {
    const running = await getRunningSession(userId);
    if (running) throw new ApiError(400, 'User đang có phiên AFK chạy');

    const [result] = await conn.execute(
      `INSERT INTO afk_sessions (user_id, started_at, claim_status, session_status)
       VALUES (?, NOW(), 'pending', 'running')`,
      [userId]
    );
    return { id: result.insertId };
  });
}

async function finishSession(userId, sessionId) {
  return transaction(async (conn) => {
    const rows = await query(
      `SELECT * FROM afk_sessions WHERE id = :sessionId AND user_id = :userId LIMIT 1`,
      { sessionId, userId }
    );
    if (!rows.length) throw new ApiError(404, 'AFK session not found');
    const session = rows[0];
    if (session.session_status !== 'running') throw new ApiError(400, 'Phiên AFK không ở trạng thái running');

    const now = new Date();
    const startedAt = new Date(session.started_at);
    const durationSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
    const baseExp = Math.floor(durationSeconds / 60) * 10;
    const bonusExp = 0;
    const totalExp = baseExp + bonusExp;

    await conn.execute(
      `UPDATE afk_sessions
       SET ended_at = NOW(), duration_seconds = ?, base_exp_earned = ?, bonus_exp_earned = ?, total_exp_earned = ?, session_status = 'finished'
       WHERE id = ?`,
      [durationSeconds, baseExp, bonusExp, totalExp, sessionId]
    );

    return { sessionId: Number(sessionId), durationSeconds, baseExp, bonusExp, totalExp };
  });
}

async function claimSession(userId, sessionId) {
  return transaction(async (conn) => {
    const rows = await query(
      `SELECT * FROM afk_sessions WHERE id = :sessionId AND user_id = :userId LIMIT 1`,
      { sessionId, userId }
    );
    if (!rows.length) throw new ApiError(404, 'AFK session not found');
    const session = rows[0];
    if (session.session_status !== 'finished') throw new ApiError(400, 'Phiên AFK chưa kết thúc');
    if (session.claim_status !== 'pending') throw new ApiError(400, 'Phiên AFK đã claim hoặc hết hạn');

    await conn.execute(
      `UPDATE afk_sessions SET claim_status = 'claimed', updated_at = NOW() WHERE id = ?`,
      [sessionId]
    );
    await conn.execute(
      `INSERT INTO afk_claim_logs (afk_session_id, user_id, claimed_exp, claimed_gold, note)
       VALUES (?, ?, ?, 0, 'Claim AFK reward')`,
      [sessionId, userId, session.total_exp_earned]
    );
    await conn.execute(
      `UPDATE user_cultivation
       SET current_exp = current_exp + ?, total_exp_earned = total_exp_earned + ?
       WHERE user_id = ?`,
      [session.total_exp_earned, session.total_exp_earned, userId]
    );

    return { sessionId: Number(sessionId), claimedExp: session.total_exp_earned };
  });
}

module.exports = { listConfigs, startSession, finishSession, claimSession };
'''
files['src/modules/afk/controllers/afk.controller.js'] = r'''
const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const afkService = require('../services/afk.service');

exports.listConfigs = asyncHandler(async (_req, res) => {
  const data = await afkService.listConfigs();
  return ApiResponse.success(res, data, 'Lấy cấu hình AFK thành công');
});

exports.startSession = asyncHandler(async (req, res) => {
  const data = await afkService.startSession(req.user.id);
  return ApiResponse.success(res, data, 'Bắt đầu AFK thành công', 201);
});

exports.finishSession = asyncHandler(async (req, res) => {
  const data = await afkService.finishSession(req.user.id, req.params.id);
  return ApiResponse.success(res, data, 'Kết thúc AFK thành công');
});

exports.claimSession = asyncHandler(async (req, res) => {
  const data = await afkService.claimSession(req.user.id, req.params.id);
  return ApiResponse.success(res, data, 'Claim AFK thành công');
});
'''
files['src/modules/afk/routes/afk.routes.js'] = r'''
const express = require('express');
const controller = require('../controllers/afk.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/configs', controller.listConfigs);
router.post('/sessions', requireAuth, controller.startSession);
router.post('/sessions/:id/finish', requireAuth, controller.finishSession);
router.post('/sessions/:id/claim', requireAuth, controller.claimSession);

module.exports = router;
'''
# shop
files['src/modules/shop/services/shop.service.js'] = r'''
const { query, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

async function listShopItems() {
  return query(
    `SELECT si.*, i.code AS item_code, i.name AS item_name, i.description, i.icon_url, i.rarity,
            i.is_stackable, i.max_stack, i.usable_instantly, i.equippable,
            it.name AS item_type_name
     FROM shop_items si
     JOIN items i ON i.id = si.item_id
     JOIN item_types it ON it.id = i.item_type_id
     WHERE si.is_active = 1
     ORDER BY si.id DESC`
  );
}

async function buyItem(userId, shopItemId, quantity = 1) {
  return transaction(async (conn) => {
    const shopRows = await query(
      `SELECT si.*, i.name AS item_name, i.id AS item_id
       FROM shop_items si
       JOIN items i ON i.id = si.item_id
       WHERE si.id = :shopItemId AND si.is_active = 1
       LIMIT 1`,
      { shopItemId }
    );
    if (!shopRows.length) throw new ApiError(404, 'Shop item not found');
    const shopItem = shopRows[0];

    const profileRows = await query(
      `SELECT * FROM user_profiles WHERE user_id = :userId LIMIT 1`,
      { userId }
    );
    if (!profileRows.length) throw new ApiError(404, 'User profile not found');
    const profile = profileRows[0];

    const totalGold = Number(shopItem.price_gold) * Number(quantity);
    const totalPremium = Number(shopItem.price_premium) * Number(quantity);

    if (Number(profile.gold_balance) < totalGold) {
      throw new ApiError(400, 'Không đủ vàng để mua vật phẩm');
    }
    if (Number(profile.premium_currency) < totalPremium) {
      throw new ApiError(400, 'Không đủ premium currency để mua vật phẩm');
    }

    await conn.execute(
      `UPDATE user_profiles
       SET gold_balance = gold_balance - ?, premium_currency = premium_currency - ?
       WHERE user_id = ?`,
      [totalGold, totalPremium, userId]
    );

    const inventoryRows = await query(
      `SELECT id, quantity FROM user_inventory WHERE user_id = :userId AND item_id = :itemId AND is_bound = 0 LIMIT 1`,
      { userId, itemId: shopItem.item_id }
    );

    if (inventoryRows.length) {
      await conn.execute('UPDATE user_inventory SET quantity = quantity + ? WHERE id = ?', [quantity, inventoryRows[0].id]);
    } else {
      await conn.execute(
        `INSERT INTO user_inventory (user_id, item_id, quantity, is_bound, obtained_from)
         VALUES (?, ?, ?, 0, 'shop')`,
        [userId, shopItem.item_id, quantity]
      );
    }

    await conn.execute(
      `INSERT INTO item_transactions
       (user_id, item_id, transaction_type, quantity, unit_price_gold, unit_price_premium, total_price_gold, total_price_premium, note)
       VALUES (?, ?, 'buy_from_shop', ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        shopItem.item_id,
        quantity,
        shopItem.price_gold,
        shopItem.price_premium,
        totalGold,
        totalPremium,
        `Mua từ shop item ${shopItem.id}`,
      ]
    );

    return { shopItemId: Number(shopItemId), itemId: shopItem.item_id, quantity, totalGold, totalPremium };
  });
}

module.exports = { listShopItems, buyItem };
'''
files['src/modules/shop/controllers/shop.controller.js'] = r'''
const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const shopService = require('../services/shop.service');

exports.listShopItems = asyncHandler(async (_req, res) => {
  const data = await shopService.listShopItems();
  return ApiResponse.success(res, data, 'Lấy danh sách vật phẩm shop thành công');
});

exports.buyItem = asyncHandler(async (req, res) => {
  const data = await shopService.buyItem(req.user.id, req.params.shopItemId, req.body.quantity || 1);
  return ApiResponse.success(res, data, 'Mua vật phẩm thành công');
});
'''
files['src/modules/shop/routes/shop.routes.js'] = r'''
const express = require('express');
const controller = require('../controllers/shop.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/items', controller.listShopItems);
router.post('/items/:shopItemId/buy', requireAuth, controller.buyItem);

module.exports = router;
'''
# chat
files['src/modules/chat/services/chat.service.js'] = r'''
const { query, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

async function listRooms(filters = {}) {
  return query(
    `SELECT cr.*, g.name AS guild_name, vl.name AS min_vip_name
     FROM chat_rooms cr
     LEFT JOIN guilds g ON g.id = cr.linked_guild_id
     LEFT JOIN vip_levels vl ON vl.id = cr.min_vip_level_id
     WHERE (:roomType IS NULL OR cr.room_type = :roomType)
       AND cr.is_active = 1
     ORDER BY cr.id DESC`,
    { roomType: filters.roomType || null }
  );
}

async function getRoomMessages(roomId, limit = 50) {
  const roomRows = await query('SELECT * FROM chat_rooms WHERE id = :roomId LIMIT 1', { roomId });
  if (!roomRows.length) throw new ApiError(404, 'Chat room not found');

  const messages = await query(
    `SELECT cm.id, cm.room_id, cm.user_id, cm.reply_to_message_id, cm.message_type, cm.content,
            cm.is_deleted, cm.sent_at,
            u.display_name, u.avatar_url
     FROM chat_messages cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.room_id = :roomId
     ORDER BY cm.sent_at DESC
     LIMIT :limit`,
    { roomId, limit: Number(limit) }
  );
  return { room: roomRows[0], messages };
}

async function sendMessage(roomId, userId, payload) {
  return transaction(async (conn) => {
    const roomRows = await query('SELECT * FROM chat_rooms WHERE id = :roomId AND is_active = 1 LIMIT 1', { roomId });
    if (!roomRows.length) throw new ApiError(404, 'Chat room not found');

    const [result] = await conn.execute(
      `INSERT INTO chat_messages (room_id, user_id, reply_to_message_id, message_type, content)
       VALUES (?, ?, ?, ?, ?)`,
      [roomId, userId, payload.replyToMessageId || null, payload.messageType || 'text', payload.content]
    );
    return { id: result.insertId };
  });
}

module.exports = { listRooms, getRoomMessages, sendMessage };
'''
files['src/modules/chat/controllers/chat.controller.js'] = r'''
const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const chatService = require('../services/chat.service');

exports.listRooms = asyncHandler(async (req, res) => {
  const data = await chatService.listRooms(req.query);
  return ApiResponse.success(res, data, 'Lấy danh sách room chat thành công');
});

exports.getRoomMessages = asyncHandler(async (req, res) => {
  const data = await chatService.getRoomMessages(req.params.roomId, req.query.limit);
  return ApiResponse.success(res, data, 'Lấy danh sách tin nhắn thành công');
});

exports.sendMessage = asyncHandler(async (req, res) => {
  const data = await chatService.sendMessage(req.params.roomId, req.user.id, req.body);
  return ApiResponse.success(res, data, 'Gửi tin nhắn thành công', 201);
});
'''
files['src/modules/chat/routes/chat.routes.js'] = r'''
const express = require('express');
const controller = require('../controllers/chat.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/rooms', controller.listRooms);
router.get('/rooms/:roomId/messages', controller.getRoomMessages);
router.post('/rooms/:roomId/messages', requireAuth, controller.sendMessage);

module.exports = router;
'''
# notifications
files['src/modules/notifications/services/notification.service.js'] = r'''
const { query } = require('../../../config/database');

async function listMyNotifications(userId, filters = {}) {
  return query(
    `SELECT *
     FROM user_notifications
     WHERE user_id = :userId
       AND (:isRead IS NULL OR is_read = :isRead)
     ORDER BY created_at DESC
     LIMIT :limit`,
    {
      userId,
      isRead: filters.isRead ?? null,
      limit: Number(filters.limit || 50),
    }
  );
}

async function markAsRead(userId, notificationId) {
  await query(
    `UPDATE user_notifications
     SET is_read = 1, read_at = NOW()
     WHERE id = :notificationId AND user_id = :userId`,
    { notificationId, userId }
  );
  return { notificationId: Number(notificationId), isRead: true };
}

module.exports = { listMyNotifications, markAsRead };
'''
files['src/modules/notifications/controllers/notification.controller.js'] = r'''
const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const notificationService = require('../services/notification.service');

exports.listMyNotifications = asyncHandler(async (req, res) => {
  const data = await notificationService.listMyNotifications(req.user.id, req.query);
  return ApiResponse.success(res, data, 'Lấy danh sách thông báo thành công');
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAsRead(req.user.id, req.params.id);
  return ApiResponse.success(res, data, 'Đánh dấu đã đọc thành công');
});
'''
files['src/modules/notifications/routes/notification.routes.js'] = r'''
const express = require('express');
const controller = require('../controllers/notification.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/me', requireAuth, controller.listMyNotifications);
router.patch('/:id/read', requireAuth, controller.markAsRead);

module.exports = router;
'''
files['docs/API_OVERVIEW.md'] = r'''
# API Overview

## Auth
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`
- POST `/api/auth/forgot-password`
- POST `/api/auth/reset-password`
- POST `/api/auth/refresh-token`
- POST `/api/auth/logout`

## Users
- GET `/api/users`
- GET `/api/users/:id`
- PATCH `/api/users/:id/status`

## Comics
- GET `/api/comics`
- GET `/api/comics/:id`
- POST `/api/comics`
- PUT `/api/comics/:id`

## Guilds
- GET `/api/guilds`
- GET `/api/guilds/:id`
- POST `/api/guilds`
- POST `/api/guilds/:id/join-requests`
- POST `/api/guilds/join-requests/:requestId/approve`
- POST `/api/guilds/:id/donations`

## VIP
- GET `/api/vip/levels`
- GET `/api/vip/features`
- GET `/api/vip/me`

## AFK
- GET `/api/afk/configs`
- POST `/api/afk/sessions`
- POST `/api/afk/sessions/:id/finish`
- POST `/api/afk/sessions/:id/claim`

## Shop
- GET `/api/shop/items`
- POST `/api/shop/items/:shopItemId/buy`

## Chat
- GET `/api/chat/rooms`
- GET `/api/chat/rooms/:roomId/messages`
- POST `/api/chat/rooms/:roomId/messages`

## Notifications
- GET `/api/notifications/me`
- PATCH `/api/notifications/:id/read`
'''
files['src/scripts/checkDb.js'] = r'''
require('dotenv').config();
const { query, testConnection } = require('../config/database');

(async () => {
  try {
    await testConnection();
    const tables = await query(`SHOW TABLES`);
    console.table(tables);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
'''

for path, content in files.items():
    p = root / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content.strip() + '\n', encoding='utf-8')
print(f'Wrote {len(files)} files')
