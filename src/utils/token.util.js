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
