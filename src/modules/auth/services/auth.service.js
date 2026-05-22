const { query, queryWithConn, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');
const { hashPassword, comparePassword } = require('../../../utils/password.util');
const { randomInt } = require('crypto');
const {
  sendResetPasswordOtpEmail,
  sendChangePasswordOtpEmail,
} = require('../../../utils/mail.util');

const {
  signAccessToken,
  signRefreshJwt,
  verifyRefreshJwt,
  generateOpaqueToken,
} = require('../../../utils/token.util');

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

async function setAuthTokenExpiryFromDbNow(conn, tokenId, minutes = 10) {
  await conn.execute(
    `UPDATE auth_tokens
     SET expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
     WHERE id = ?`,
    [minutes, tokenId]
  );
}


function normalizeOtp(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

function parseTokenMeta(tokenRow) {
  if (!tokenRow) return {};
  if (!tokenRow.meta_json) return {};

  let rawMeta = tokenRow.meta_json;

  if (Buffer.isBuffer(rawMeta)) {
    rawMeta = rawMeta.toString('utf8');
  }

  if (typeof rawMeta === 'object') return rawMeta;

  if (typeof rawMeta !== 'string') return {};

  try {
    return JSON.parse(rawMeta);
  } catch (_) {
    // Một số MySQL driver có thể trả JSON dạng string bị escape 2 lần.
    try {
      return JSON.parse(JSON.parse(rawMeta));
    } catch (_) {
      return {};
    }
  }
}

function tokenAgeMinutes(tokenRow) {
  const raw = tokenRow?.age_minutes;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 999999;
}

async function register(data, context = {}) {
  return transaction(async (conn) => {
    const existing = await queryWithConn(
      conn,
      `SELECT id
       FROM users
       WHERE (username = :username OR email = :email)
         AND deleted_at IS NULL
       LIMIT 1`,
      { username: data.username, email: data.email }
    );

    if (existing.length) throw new ApiError(409, 'Username hoặc email đã tồn tại');

    const userRoleId = await findRoleIdByCode('user');
    const passwordHash = await hashPassword(data.password);

    const [userResult] = await conn.execute(
      `INSERT INTO users
        (role_id, username, email, password_hash, display_name, account_status, is_verified, is_email_verified)
       VALUES (?, ?, ?, ?, ?, 'active', 0, 0)`,
      [userRoleId, data.username, data.email, passwordHash, data.displayName || data.username]
    );

    const userId = userResult.insertId;

    await conn.execute(
      `INSERT INTO user_profiles
        (user_id, full_name, gold_balance, premium_currency, energy, stamina, power_score)
       VALUES (?, ?, 0, 0, 100, 100, 0)`,
      [userId, data.displayName || data.username]
    );

    const levels = await queryWithConn(conn, 'SELECT id FROM levels ORDER BY level_number ASC LIMIT 1');
    const realms = await queryWithConn(conn, 'SELECT id FROM realms ORDER BY realm_order ASC LIMIT 1');
    const vipLevels = await queryWithConn(conn, 'SELECT id FROM vip_levels ORDER BY level_number ASC LIMIT 1');

    if (levels.length && realms.length) {
      await conn.execute(
        `INSERT INTO user_cultivation
          (user_id, current_level_id, current_realm_id, current_exp, total_exp_earned, combat_power)
         VALUES (?, ?, ?, 0, 0, 0)`,
        [userId, levels[0].id, realms[0].id]
      );
    }

    if (vipLevels.length) {
      await conn.execute(
        `INSERT INTO user_vip
          (user_id, current_vip_level_id, total_topup_amount, vip_exp)
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
    const cleanEmail = String(email || '').trim().toLowerCase();

    const users = await queryWithConn(
      conn,
      `SELECT id, email
       FROM users
       WHERE email = :email
         AND deleted_at IS NULL
       LIMIT 1`,
      { email: cleanEmail }
    );

    if (!users.length) {
      return {
        message: 'Nếu email tồn tại, hệ thống đã gửi mã OTP đặt lại mật khẩu',
      };
    }

    const user = users[0];

    // Không thu hồi OTP cũ ngay khi gửi OTP mới.
    // Gmail thường gom nhiều mail cùng subject thành một thread, dễ làm người dùng mở nhầm mail.
    // Với project/demo, cho phép mọi OTP chưa dùng trong 10 phút đều hợp lệ để tránh nhập đúng mã nhưng bị báo sai.

    const otp = String(randomInt(0, 1000000)).padStart(6, '0');
    const resetToken = generateOpaqueToken('reset_otp');

    // Dùng giờ của MySQL để tránh lỗi lệch timezone giữa Node/Windows và MySQL.
    // Nếu dùng new Date(Date.now() + 10 phút), MySQL NOW() có thể coi OTP hết hạn ngay.
    const resetTokenId = await storeAuthToken(conn, {
      userId: user.id,
      tokenType: 'reset_password',
      tokenValue: resetToken,
      expiresAt: null,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metaJson: {
        purpose: 'forgot_password_otp',
        email: cleanEmail,
        otp,
      },
    });
    await setAuthTokenExpiryFromDbNow(conn, resetTokenId, 10);

    try {
      await sendResetPasswordOtpEmail({
        to: cleanEmail,
        otp,
      });
    } catch (error) {
      throw new ApiError(
        500,
        'Không gửi được mã OTP qua email. Hãy kiểm tra SMTP_USER/SMTP_PASS trong .env và thử lại.'
      );
    }

    return {
      message: 'Nếu email tồn tại, hệ thống đã gửi mã OTP đặt lại mật khẩu',
    };
  });
}

async function resetPassword(email, otp, newPassword) {
  return transaction(async (conn) => {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanOtp = normalizeOtp(otp);

    const users = await queryWithConn(
      conn,
      `SELECT id
       FROM users
       WHERE email = :email
         AND deleted_at IS NULL
       LIMIT 1`,
      { email: cleanEmail }
    );

    if (!users.length) {
      throw new ApiError(400, 'OTP không hợp lệ hoặc đã hết hạn');
    }

    const user = users[0];

    // Không lọc bằng expires_at ở SQL vì một số máy Windows/MySQL lệch timezone
    // có thể làm OTP vừa gửi đã bị coi là hết hạn. Thay vào đó, lấy token mới
    // và kiểm tra tuổi OTP bằng created_at của MySQL.
    const tokens = await queryWithConn(
      conn,
      `SELECT *, TIMESTAMPDIFF(MINUTE, created_at, NOW()) AS age_minutes
       FROM auth_tokens
       WHERE user_id = :userId
         AND token_type = 'reset_password'
         AND used_at IS NULL
       ORDER BY id DESC
       LIMIT 10`,
      { userId: user.id }
    );

    const matchedToken = tokens.find((tokenRow) => {
      const meta = parseTokenMeta(tokenRow);
      return (
        meta.purpose === 'forgot_password_otp' &&
        String(meta.email || '').trim().toLowerCase() === cleanEmail &&
        normalizeOtp(meta.otp) === cleanOtp
      );
    });

    if (!matchedToken) {
      throw new ApiError(400, 'OTP không hợp lệ hoặc không thuộc tài khoản này. Hãy nhập đúng 6 số trong email OTP gần đây.');
    }

    if (tokenAgeMinutes(matchedToken) > 10) {
      throw new ApiError(400, 'OTP đã hết hạn. Hãy bấm gửi lại mã OTP mới.');
    }

    const passwordHash = await hashPassword(newPassword);

    await conn.execute(
      `UPDATE users
       SET password_hash = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [passwordHash, user.id]
    );

    await conn.execute(
      `UPDATE auth_tokens
       SET used_at = NOW(), revoked_at = COALESCE(revoked_at, NOW())
       WHERE user_id = ?
         AND token_type = 'reset_password'
         AND used_at IS NULL`,
      [user.id]
    );

    await conn.execute(
      `UPDATE auth_tokens
       SET revoked_at = NOW()
       WHERE user_id = ?
         AND token_type IN ('refresh_token', 'session_token')
         AND revoked_at IS NULL`,
      [user.id]
    );

    return {
      message: 'Đặt lại mật khẩu thành công',
    };
  });
}


async function requestChangePasswordOtp(userId, context = {}) {
  return transaction(async (conn) => {
    const users = await queryWithConn(
      conn,
      `SELECT id, email, account_status
       FROM users
       WHERE id = :userId
         AND deleted_at IS NULL
       LIMIT 1`,
      { userId }
    );

    if (!users.length) throw new ApiError(404, 'Không tìm thấy tài khoản');

    const user = users[0];
    if (['banned', 'suspended'].includes(user.account_status)) {
      throw new ApiError(403, 'Tài khoản đang bị khóa');
    }

    const cleanEmail = String(user.email || '').trim().toLowerCase();
    if (!cleanEmail) throw new ApiError(400, 'Tài khoản chưa có email để gửi OTP');

    // Không thu hồi OTP cũ ngay khi gửi OTP mới.
    // Gmail có thể gộp nhiều OTP trong cùng một thread; nếu thu hồi mã cũ ngay,
    // người dùng rất dễ nhập đúng mã đang nhìn thấy nhưng backend lại coi là sai.

    const otp = String(randomInt(0, 1000000)).padStart(6, '0');
    const otpToken = generateOpaqueToken('change_otp');

    // Dùng giờ của MySQL để tránh lỗi lệch timezone giữa Node/Windows và MySQL.
    // Nếu dùng new Date(Date.now() + 10 phút), MySQL NOW() có thể coi OTP hết hạn ngay.
    const otpTokenId = await storeAuthToken(conn, {
      userId: user.id,
      tokenType: 'change_password_otp',
      tokenValue: otpToken,
      expiresAt: null,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metaJson: {
        purpose: 'change_password_otp',
        email: cleanEmail,
        otp,
      },
    });
    await setAuthTokenExpiryFromDbNow(conn, otpTokenId, 10);

    try {
      await sendChangePasswordOtpEmail({
        to: cleanEmail,
        otp,
      });
    } catch (error) {
      throw new ApiError(
        500,
        'Không gửi được mã OTP qua email. Hãy kiểm tra SMTP_USER/SMTP_PASS trong .env và thử lại.'
      );
    }

    return {
      email: cleanEmail,
      message: 'Đã gửi mã OTP đổi mật khẩu về email của bạn',
    };
  });
}

async function confirmChangePasswordWithOtp(userId, otp, newPassword) {
  return transaction(async (conn) => {
    const cleanOtp = normalizeOtp(otp);
    const cleanPassword = String(newPassword || '').trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      throw new ApiError(400, 'OTP phải gồm 6 số');
    }

    if (cleanPassword.length < 6) {
      throw new ApiError(400, 'Mật khẩu mới phải có ít nhất 6 ký tự');
    }

    const users = await queryWithConn(
      conn,
      `SELECT id, email
       FROM users
       WHERE id = :userId
         AND deleted_at IS NULL
       LIMIT 1`,
      { userId }
    );

    if (!users.length) throw new ApiError(404, 'Không tìm thấy tài khoản');

    const user = users[0];
    const cleanEmail = String(user.email || '').trim().toLowerCase();

    // Không lọc bằng expires_at ở SQL vì một số máy Windows/MySQL lệch timezone
    // có thể làm OTP vừa gửi đã bị coi là hết hạn. Thay vào đó, lấy token mới
    // và kiểm tra tuổi OTP bằng created_at của MySQL.
    const tokens = await queryWithConn(
      conn,
      `SELECT *, TIMESTAMPDIFF(MINUTE, created_at, NOW()) AS age_minutes
       FROM auth_tokens
       WHERE user_id = :userId
         AND token_type = 'change_password_otp'
         AND used_at IS NULL
       ORDER BY id DESC
       LIMIT 10`,
      { userId }
    );

    const matchedToken = tokens.find((tokenRow) => {
      const meta = parseTokenMeta(tokenRow);
      return (
        meta.purpose === 'change_password_otp' &&
        String(meta.email || '').trim().toLowerCase() === cleanEmail &&
        normalizeOtp(meta.otp) === cleanOtp
      );
    });

    if (!matchedToken) {
      throw new ApiError(400, 'OTP không hợp lệ hoặc không thuộc tài khoản này. Hãy nhập đúng 6 số trong email OTP gần đây.');
    }

    if (tokenAgeMinutes(matchedToken) > 10) {
      throw new ApiError(400, 'OTP đã hết hạn. Hãy bấm gửi lại mã OTP mới.');
    }

    const passwordHash = await hashPassword(cleanPassword);

    await conn.execute(
      `UPDATE users
       SET password_hash = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [passwordHash, user.id]
    );

    await conn.execute(
      `UPDATE auth_tokens
       SET used_at = NOW(), revoked_at = COALESCE(revoked_at, NOW())
       WHERE user_id = ?
         AND token_type = 'change_password_otp'
         AND used_at IS NULL`,
      [user.id]
    );

    await conn.execute(
      `UPDATE auth_tokens
       SET revoked_at = NOW()
       WHERE user_id = ?
         AND token_type IN ('refresh_token', 'session_token')
         AND revoked_at IS NULL`,
      [user.id]
    );

    return {
      message: 'Đổi mật khẩu thành công. Các phiên đăng nhập cũ đã bị thu hồi.',
    };
  });
}

async function refreshToken(refreshToken, context = {}) {
  return transaction(async (conn) => {
    try {
      verifyRefreshJwt(refreshToken);
    } catch {
      throw new ApiError(401, 'Refresh token JWT không hợp lệ');
    }

    const tokenRows = await queryWithConn(
      conn,
      `SELECT *
       FROM auth_tokens
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

    const userRows = await queryWithConn(
      conn,
      `SELECT u.id, r.code AS role_code
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = :id
       LIMIT 1`,
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

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  });
}

async function logout(userId, tokenValue) {
  if (!tokenValue) {
    throw new ApiError(400, 'tokenValue là bắt buộc');
  }

  await query(
    `UPDATE auth_tokens
     SET revoked_at = NOW()
     WHERE user_id = :userId
       AND token_value = :tokenValue
       AND revoked_at IS NULL`,
    { userId, tokenValue }
  );

  return { message: 'Đăng xuất thành công' };
}

async function verifyEmail(token) {
  if (!token) {
    throw new ApiError(400, 'Token là bắt buộc');
  }

  return transaction(async (conn) => {
    const tokenRows = await queryWithConn(
      conn,
      `SELECT *
       FROM auth_tokens
       WHERE token_value = :token
         AND token_type = 'verify_email'
         AND used_at IS NULL
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      { token }
    );

    if (!tokenRows.length) {
      throw new ApiError(400, 'Token xác thực không hợp lệ hoặc đã hết hạn');
    }

    const tokenRow = tokenRows[0];

    await conn.execute(
      `UPDATE users
       SET is_email_verified = 1,
           is_verified = 1,
           email_verified_at = NOW()
       WHERE id = ?`,
      [tokenRow.user_id]
    );

    await conn.execute(
      `UPDATE auth_tokens
       SET used_at = NOW()
       WHERE id = ?`,
      [tokenRow.id]
    );

    return {
      userId: tokenRow.user_id,
      verified: true,
      message: 'Xác thực email thành công',
    };
  });
}



async function changePassword(userId, currentPassword, newPassword) {
  return transaction(async (conn) => {
    const userRows = await queryWithConn(
      conn,
      `SELECT id, password_hash FROM users WHERE id = :userId LIMIT 1`,
      { userId }
    );

    if (!userRows.length) throw new ApiError(404, 'User not found');

    const isMatch = await comparePassword(currentPassword, userRows[0].password_hash);
    if (!isMatch) throw new ApiError(400, 'Mật khẩu hiện tại không đúng');

    const newHash = await hashPassword(newPassword);
    await conn.execute(`UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`, [newHash, userId]);
    await conn.execute(
      `UPDATE auth_tokens
       SET revoked_at = NOW()
       WHERE user_id = ?
         AND token_type IN ('refresh_token', 'session_token')
         AND revoked_at IS NULL`,
      [userId]
    );

    return { message: 'Đổi mật khẩu thành công. Các phiên đăng nhập cũ đã bị thu hồi.' };
  });
}

async function getSecurityOverview(userId) {
  const [sessions, tokenStats] = await Promise.all([
    query(
      `SELECT id, token_value, ip_address, user_agent, expires_at, created_at, updated_at
       FROM auth_tokens
       WHERE user_id = :userId
         AND token_type = 'session_token'
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC`,
      { userId }
    ),
    query(
      `SELECT
          SUM(CASE WHEN token_type = 'refresh_token' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()) THEN 1 ELSE 0 END) AS active_refresh_tokens,
          SUM(CASE WHEN token_type = 'session_token' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()) THEN 1 ELSE 0 END) AS active_sessions
       FROM auth_tokens
       WHERE user_id = :userId`,
      { userId }
    ),
  ]);

  return {
    active_session_count: Number(tokenStats[0]?.active_sessions || 0),
    active_refresh_token_count: Number(tokenStats[0]?.active_refresh_tokens || 0),
    sessions: sessions.map((session) => ({
      id: Number(session.id),
      session_token: session.token_value,
      ip_address: session.ip_address,
      user_agent: session.user_agent,
      created_at: session.created_at,
      expires_at: session.expires_at,
      last_updated_at: session.updated_at,
    })),
  };
}

async function revokeSession(userId, sessionToken) {
  if (!sessionToken) throw new ApiError(400, 'sessionToken là bắt buộc');

  const result = await query(
    `UPDATE auth_tokens
     SET revoked_at = NOW()
     WHERE user_id = :userId
       AND token_type = 'session_token'
       AND token_value = :sessionToken
       AND revoked_at IS NULL`,
    { userId, sessionToken }
  );

  return { revoked: true, session_token: sessionToken, result };
}

async function revokeOtherSessions(userId, currentSessionToken = null) {
  await query(
    `UPDATE auth_tokens
     SET revoked_at = NOW()
     WHERE user_id = :userId
       AND token_type = 'session_token'
       AND revoked_at IS NULL
       AND (:currentSessionToken IS NULL OR token_value <> :currentSessionToken)`,
    { userId, currentSessionToken }
  );

  await query(
    `UPDATE auth_tokens
     SET revoked_at = NOW()
     WHERE user_id = :userId
       AND token_type = 'refresh_token'
       AND revoked_at IS NULL`,
    { userId }
  );

  return { revoked_other_sessions: true };
}

module.exports = {
  register,
  login,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  requestChangePasswordOtp,
  confirmChangePasswordWithOtp,
  refreshToken,
  logout,
  verifyEmail,
  changePassword,
  getSecurityOverview,
  revokeSession,
  revokeOtherSessions,
};