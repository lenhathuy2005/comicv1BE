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
