const { query, queryWithConn, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

async function listUsers() {
  return query(
    `
    SELECT
      u.id,
      u.username,
      u.email,
      u.display_name,
      u.avatar_url,
      u.account_status,
      u.is_verified,
      u.is_email_verified,
      u.created_at,
      r.code AS role_code,
      r.name AS role_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.deleted_at IS NULL
    ORDER BY u.id DESC
    `
  );
}

async function getMyProfile(userId) {
  const rows = await query(
    `
    SELECT 
      u.id,
      u.username,
      u.email,
      u.display_name,
      u.avatar_url,
      u.account_status,
      u.is_verified,
      u.is_email_verified,
      u.created_at,
      r.code AS role_code,
      r.name AS role_name,
      up.full_name,
      up.phone_number,
      up.gender,
      up.birth_date,
      up.bio,
      up.country,
      up.gold_balance,
      up.premium_currency,
      up.energy,
      up.stamina,
      up.power_score,
      up.current_title
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE u.id = :userId
      AND u.deleted_at IS NULL
    LIMIT 1
    `,
    { userId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }

  return rows[0];
}

async function getUserById(userId) {
  const rows = await query(
    `
    SELECT 
      u.id,
      u.username,
      u.email,
      u.display_name,
      u.avatar_url,
      u.account_status,
      u.is_verified,
      u.is_email_verified,
      u.created_at,
      r.code AS role_code,
      r.name AS role_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = :userId
      AND u.deleted_at IS NULL
    LIMIT 1
    `,
    { userId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }

  return rows[0];
}

async function getUserDetail(userId) {
  return getUserById(userId);
}

async function updateUserStatus({ userId, newStatus, changedByUserId, reason = null }) {
  const allowedStatuses = ['active', 'banned', 'suspended', 'pending'];

  if (!allowedStatuses.includes(newStatus)) {
    throw new ApiError(400, 'Trạng thái không hợp lệ');
  }

  return transaction(async (conn) => {
    const users = await queryWithConn(
      conn,
      `
      SELECT id, account_status
      FROM users
      WHERE id = :userId
      LIMIT 1
      `,
      { userId }
    );

    if (!users.length) {
      throw new ApiError(404, 'Không tìm thấy người dùng');
    }

    const oldStatus = users[0].account_status;

    await conn.query(
      `
      UPDATE users
      SET account_status = :newStatus,
          updated_at = NOW()
      WHERE id = :userId
      `,
      { newStatus, userId }
    );

    await conn.query(
      `
      INSERT INTO user_status_logs (
        user_id,
        old_status,
        new_status,
        reason,
        changed_by_user_id,
        created_at
      )
      VALUES (
        :userId,
        :oldStatus,
        :newStatus,
        :reason,
        :changedByUserId,
        NOW()
      )
      `,
      {
        userId,
        oldStatus,
        newStatus,
        reason,
        changedByUserId,
      }
    );

    return {
      success: true,
      message: 'Cập nhật trạng thái người dùng thành công',
    };
  });
}

module.exports = {
  listUsers,
  getMyProfile,
  getUserById,
  getUserDetail,
  updateUserStatus,
};