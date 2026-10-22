const { query, queryWithConn, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

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

async function listSystemNotificationsAdmin(filters = {}) {
  const q = filters.q ? `%${String(filters.q).trim()}%` : null;
  const status = filters.status || null;
  const targetScope = filters.targetScope || null;

  const items = await query(
    `SELECT
        sn.*,
        sender.display_name AS sender_name,
        COUNT(un.id) AS recipient_count,
        SUM(CASE WHEN un.is_read = 1 THEN 1 ELSE 0 END) AS read_count
      FROM system_notifications sn
      LEFT JOIN user_notifications un ON un.system_notification_id = sn.id
      LEFT JOIN users sender ON sender.id = sn.sent_by_user_id
      WHERE (:q IS NULL OR CONCAT(IFNULL(sn.title,''), ' ', IFNULL(sn.content,'')) LIKE :q)
        AND (:status IS NULL OR sn.notification_status = :status)
        AND (:targetScope IS NULL OR sn.target_scope = :targetScope)
      GROUP BY sn.id, sender.display_name
      ORDER BY COALESCE(sn.scheduled_at, sn.sent_at, sn.created_at) DESC, sn.id DESC`,
    { q, status, targetScope }
  );

  const stats = {
    total: items.length,
    sent: items.filter((item) => item.notification_status === 'sent').length,
    scheduled: items.filter((item) => item.notification_status === 'scheduled').length,
    draft: items.filter((item) => item.notification_status === 'draft').length,
  };

  return { stats, items };
}

async function createSystemNotificationAdmin(actorUserId, payload = {}) {
  const {
    title,
    content,
    target_scope = 'all',
    scheduled_at = null,
    notification_status = 'draft',
  } = payload;

  if (!title || !content) {
    throw new ApiError(400, 'title và content là bắt buộc');
  }

  return transaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO system_notifications (
        title, content, target_scope, sent_by_user_id, scheduled_at, notification_status, created_at, updated_at
      ) VALUES (
        :title, :content, :target_scope, :actorUserId, :scheduled_at, :notification_status, NOW(), NOW()
      )`,
      { title, content, target_scope, actorUserId, scheduled_at, notification_status }
    );

    const rows = await queryWithConn(conn, `SELECT * FROM system_notifications WHERE id = :id LIMIT 1`, { id: result.insertId });
    return rows[0];
  });
}

async function updateSystemNotificationAdmin(id, payload = {}) {
  const rows = await query(`SELECT * FROM system_notifications WHERE id = :id LIMIT 1`, { id });
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy thông báo hệ thống');
  const current = rows[0];
  const next = {
    title: payload.title ?? current.title,
    content: payload.content ?? current.content,
    target_scope: payload.target_scope ?? current.target_scope,
    scheduled_at: payload.scheduled_at ?? current.scheduled_at,
    notification_status: payload.notification_status ?? current.notification_status,
  };
  await query(
    `UPDATE system_notifications
     SET title = :title,
         content = :content,
         target_scope = :target_scope,
         scheduled_at = :scheduled_at,
         notification_status = :notification_status,
         updated_at = NOW()
     WHERE id = :id`,
    { id, ...next }
  );
  return (await query(`SELECT * FROM system_notifications WHERE id = :id LIMIT 1`, { id }))[0];
}

async function deleteSystemNotificationAdmin(id) {
  await transaction(async (conn) => {
    await conn.query(`DELETE FROM user_notifications WHERE system_notification_id = :id`, { id });
    await conn.query(`DELETE FROM system_notifications WHERE id = :id`, { id });
  });
  return { id: Number(id), deleted: true };
}

async function resolveTargetUserIds(conn, notification, providedUserIds = []) {
  if (notification.target_scope === 'all') {
    const rows = await queryWithConn(conn, `SELECT id FROM users WHERE deleted_at IS NULL`);
    return rows.map((row) => row.id);
  }
  if (notification.target_scope === 'vip_only') {
    const rows = await queryWithConn(conn, `SELECT DISTINCT user_id AS id FROM user_vip WHERE current_vip_level_id IS NOT NULL`);
    return rows.map((row) => row.id);
  }
  if (notification.target_scope === 'guild_only') {
    const rows = await queryWithConn(conn, `SELECT DISTINCT current_guild_id AS id FROM users WHERE current_guild_id IS NOT NULL`);
    const guildIds = rows.map((row) => row.id).filter(Boolean);
    if (!guildIds.length) return [];
    const users = await queryWithConn(conn, `SELECT id FROM users WHERE current_guild_id IS NOT NULL AND deleted_at IS NULL`);
    return users.map((row) => row.id);
  }
  return Array.isArray(providedUserIds) ? providedUserIds.map(Number).filter(Boolean) : [];
}

async function sendSystemNotificationAdmin(id, actorUserId, payload = {}) {
  return transaction(async (conn) => {
    const rows = await queryWithConn(conn, `SELECT * FROM system_notifications WHERE id = :id LIMIT 1`, { id });
    if (!rows.length) throw new ApiError(404, 'Không tìm thấy thông báo hệ thống');
    const notification = rows[0];

    const userIds = await resolveTargetUserIds(conn, notification, payload.userIds || []);
    for (const userId of userIds) {
      await conn.query(
        `INSERT INTO user_notifications (
          system_notification_id, user_id, title, content, is_read, created_at
        ) VALUES (
          :id, :userId, :title, :content, 0, NOW()
        )`,
        { id, userId, title: notification.title, content: notification.content }
      );
    }

    await conn.query(
      `UPDATE system_notifications
       SET notification_status = 'sent',
           sent_by_user_id = :actorUserId,
           sent_at = NOW(),
           updated_at = NOW()
       WHERE id = :id`,
      { id, actorUserId }
    );

    return {
      id: Number(id),
      sentCount: userIds.length,
      notification_status: 'sent',
    };
  });
}

module.exports = {
  listMyNotifications,
  markAsRead,
  listSystemNotificationsAdmin,
  createSystemNotificationAdmin,
  updateSystemNotificationAdmin,
  deleteSystemNotificationAdmin,
  sendSystemNotificationAdmin,
};
