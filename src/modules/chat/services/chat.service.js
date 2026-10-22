const { query, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');


async function getActiveGuildForUser(userId) {
  if (!userId) return null;

  const rows = await query(
    `
    SELECT
      g.id,
      g.name,
      g.slug,
      gm.guild_role_id,
      gr.code AS role_code
    FROM guild_members gm
    INNER JOIN guilds g ON g.id = gm.guild_id
    LEFT JOIN guild_roles gr ON gr.id = gm.guild_role_id
    WHERE gm.user_id = :userId
      AND gm.join_status = 'active'
      AND g.guild_status = 'active'
    ORDER BY gm.joined_at DESC, gm.id DESC
    LIMIT 1
    `,
    { userId }
  );

  return rows[0] || null;
}

function safeGuildChatCode(guild) {
  const source = String(guild.slug || guild.name || `guild-${guild.id}`)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `guild-${guild.id}`;

  return `guild-${source}-${guild.id}`.slice(0, 100);
}

async function ensureGuildChatRoomForUser(userId) {
  const guild = await getActiveGuildForUser(userId);
  if (!guild) return null;

  const existing = await query(
    `
    SELECT id
    FROM chat_rooms
    WHERE room_type = 'guild'
      AND linked_guild_id = :guildId
      AND is_active = 1
    ORDER BY id ASC
    LIMIT 1
    `,
    { guildId: guild.id }
  );

  let roomId = existing[0]?.id || null;

  if (!roomId) {
    const code = safeGuildChatCode(guild);
    const result = await query(
      `
      INSERT INTO chat_rooms (
        room_type, name, code, description, linked_guild_id, min_vip_level_id,
        is_active, created_by_user_id, created_at, updated_at
      ) VALUES (
        'guild', :name, :code, :description, :guildId, NULL,
        1, :userId, NOW(), NOW()
      )
      `,
      {
        name: `Chat ${guild.name}`,
        code,
        description: `Kênh chat nội bộ bang ${guild.name}`,
        guildId: guild.id,
        userId,
      }
    );

    roomId = result.insertId;
  }

  await query(
    `
    INSERT INTO chat_room_members (room_id, user_id, member_role, joined_at, is_active)
    VALUES (:roomId, :userId, :memberRole, NOW(), 1)
    ON DUPLICATE KEY UPDATE
      member_role = VALUES(member_role),
      is_active = 1
    `,
    {
      roomId,
      userId,
      memberRole: guild.role_code === 'leader' ? 'owner' : 'member',
    }
  );

  return guild;
}

async function canAccessGuildRoom(room, userId) {
  if (room.room_type !== 'guild') return true;
  if (!userId || !room.linked_guild_id) return false;

  const guild = await getActiveGuildForUser(userId);
  return Boolean(guild && Number(guild.id) === Number(room.linked_guild_id));
}

async function getRoomForAccess(roomId, userId = null) {
  const roomRows = await query(
    `
    SELECT cr.*, g.name AS guild_name, vl.name AS min_vip_name
    FROM chat_rooms cr
    LEFT JOIN guilds g ON g.id = cr.linked_guild_id
    LEFT JOIN vip_levels vl ON vl.id = cr.min_vip_level_id
    WHERE cr.id = :roomId
      AND cr.is_active = 1
    LIMIT 1
    `,
    { roomId }
  );

  if (!roomRows.length) throw new ApiError(404, 'Không tìm thấy phòng chat');

  const room = roomRows[0];

  if (room.room_type === 'guild') {
    const ok = await canAccessGuildRoom(room, userId);
    if (!ok) {
      throw new ApiError(403, 'Bạn chưa tham gia bang hội này nên không thể xem chat bang');
    }
  }

  return room;
}

async function listRooms(filters = {}, userId = null) {
  const roomType = filters.roomType || filters.room_type || null;
  const myGuild = await ensureGuildChatRoomForUser(userId);
  const myGuildId = myGuild ? Number(myGuild.id) : null;

  return query(
    `
    SELECT
      cr.*,
      g.name AS guild_name,
      vl.name AS min_vip_name,
      COUNT(DISTINCT CASE WHEN crm.is_active = 1 THEN crm.id END) AS member_count,
      COUNT(DISTINCT CASE WHEN cm.is_deleted = 0 THEN cm.id END) AS message_count,
      MAX(CASE WHEN cm.is_deleted = 0 THEN cm.sent_at END) AS last_message_at
    FROM chat_rooms cr
    LEFT JOIN guilds g ON g.id = cr.linked_guild_id
    LEFT JOIN vip_levels vl ON vl.id = cr.min_vip_level_id
    LEFT JOIN chat_room_members crm ON crm.room_id = cr.id
    LEFT JOIN chat_messages cm ON cm.room_id = cr.id
    WHERE (:roomType IS NULL OR cr.room_type = :roomType)
      AND cr.is_active = 1
      AND (
        cr.room_type <> 'guild'
        OR (:myGuildId IS NOT NULL AND cr.linked_guild_id = :myGuildId)
      )
    GROUP BY cr.id, g.name, vl.name
    ORDER BY
      CASE cr.room_type
        WHEN 'global' THEN 1
        WHEN 'public' THEN 2
        WHEN 'world' THEN 3
        WHEN 'vip' THEN 4
        WHEN 'guild' THEN 5
        WHEN 'system' THEN 6
        ELSE 7
      END,
      last_message_at DESC,
      cr.id ASC
    `,
    { roomType, myGuildId }
  );
}

async function getRoomMessages(roomId, limit = 50, userId = null) {
  const room = await getRoomForAccess(roomId, userId);

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
  return { room, messages };
}

async function sendMessage(roomId, userId, payload) {
  if (!userId) throw new ApiError(401, 'Unauthorized');

  return transaction(async (conn) => {
    const room = await getRoomForAccess(roomId, userId);

    const content = String(payload.content || '').trim();
    if (!content) {
      throw new ApiError(400, 'Nội dung tin nhắn không được để trống');
    }

    const [result] = await conn.execute(
      `INSERT INTO chat_messages (room_id, user_id, reply_to_message_id, message_type, content)
       VALUES (?, ?, ?, ?, ?)`,
      [room.id, userId, payload.replyToMessageId || null, payload.messageType || payload.message_type || 'text', content]
    );

    const memberRole = room.room_type === 'guild' ? 'member' : 'member';
    await conn.query(
      `
      INSERT INTO chat_room_members (room_id, user_id, member_role, joined_at, is_active)
      VALUES (:roomId, :userId, :memberRole, NOW(), 1)
      ON DUPLICATE KEY UPDATE is_active = 1
      `,
      { roomId: room.id, userId, memberRole }
    );

    return { id: result.insertId };
  });
}

async function listRoomsAdmin(filters = {}) {
  const q = filters.q ? `%${String(filters.q).trim()}%` : null;
  const rooms = await query(
    `SELECT
        cr.*,
        g.name AS guild_name,
        vl.name AS min_vip_name,
        COUNT(DISTINCT crm.id) AS member_count,
        COUNT(DISTINCT CASE WHEN crm.is_active = 1 THEN crm.id END) AS active_member_count,
        COUNT(DISTINCT cm.id) AS message_count,
        MAX(cm.sent_at) AS last_message_at
      FROM chat_rooms cr
      LEFT JOIN guilds g ON g.id = cr.linked_guild_id
      LEFT JOIN vip_levels vl ON vl.id = cr.min_vip_level_id
      LEFT JOIN chat_room_members crm ON crm.room_id = cr.id
      LEFT JOIN chat_messages cm ON cm.room_id = cr.id AND cm.is_deleted = 0
      WHERE (:q IS NULL OR CONCAT(IFNULL(cr.name,''), ' ', IFNULL(cr.code,''), ' ', IFNULL(cr.description,'')) LIKE :q)
      GROUP BY cr.id, g.name, vl.name
      ORDER BY cr.is_active DESC, last_message_at DESC, cr.id DESC`,
    { q }
  );

  const reportRows = await listReportsAdmin();
  const stats = {
    totalMessages: rooms.reduce((sum, room) => sum + Number(room.message_count || 0), 0),
    activeRooms: rooms.filter((room) => Number(room.is_active) === 1).length,
    pendingReports: reportRows.filter((row) => row.report_status === 'pending').length,
    totalMembers: rooms.reduce((sum, room) => sum + Number(room.active_member_count || 0), 0),
  };

  return { stats, rooms, reports: reportRows };
}

async function getRoomMessagesAdmin(roomId, limit = 100) {
  const roomRows = await query(
    `SELECT cr.*, g.name AS guild_name, vl.name AS min_vip_name
     FROM chat_rooms cr
     LEFT JOIN guilds g ON g.id = cr.linked_guild_id
     LEFT JOIN vip_levels vl ON vl.id = cr.min_vip_level_id
     WHERE cr.id = :roomId
     LIMIT 1`,
    { roomId }
  );
  if (!roomRows.length) throw new ApiError(404, 'Không tìm thấy phòng chat');

  const messages = await query(
    `SELECT cm.id, cm.room_id, cm.user_id, cm.reply_to_message_id, cm.message_type, cm.content,
            cm.is_deleted, cm.sent_at, cm.deleted_at,
            u.display_name, u.username, u.avatar_url
     FROM chat_messages cm
     INNER JOIN users u ON u.id = cm.user_id
     WHERE cm.room_id = :roomId
     ORDER BY cm.sent_at DESC
     LIMIT :limit`,
    { roomId, limit: Number(limit) }
  );

  return { room: roomRows[0], messages };
}

async function createRoomAdmin(actorUserId, payload = {}) {
  const { room_type = 'custom', name, code, description = null, linked_guild_id = null, min_vip_level_id = null, is_active = 1 } = payload;
  if (!name || !code) throw new ApiError(400, 'name và code là bắt buộc');

  return transaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO chat_rooms (
        room_type, name, code, description, linked_guild_id, min_vip_level_id, is_active, created_by_user_id, created_at, updated_at
      ) VALUES (
        :room_type, :name, :code, :description, :linked_guild_id, :min_vip_level_id, :is_active, :actorUserId, NOW(), NOW()
      )`,
      { room_type, name, code, description, linked_guild_id, min_vip_level_id, is_active: is_active ? 1 : 0, actorUserId }
    );

    return (await query(`SELECT * FROM chat_rooms WHERE id = :id LIMIT 1`, { id: result.insertId }))[0];
  });
}

async function updateRoomAdmin(roomId, payload = {}) {
  const rows = await query(`SELECT * FROM chat_rooms WHERE id = :roomId LIMIT 1`, { roomId });
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy phòng chat');
  const current = rows[0];
  const next = {
    room_type: payload.room_type ?? current.room_type,
    name: payload.name ?? current.name,
    code: payload.code ?? current.code,
    description: payload.description ?? current.description,
    linked_guild_id: payload.linked_guild_id ?? current.linked_guild_id,
    min_vip_level_id: payload.min_vip_level_id ?? current.min_vip_level_id,
    is_active: payload.is_active ?? current.is_active,
  };
  await query(
    `UPDATE chat_rooms
     SET room_type = :room_type,
         name = :name,
         code = :code,
         description = :description,
         linked_guild_id = :linked_guild_id,
         min_vip_level_id = :min_vip_level_id,
         is_active = :is_active,
         updated_at = NOW()
     WHERE id = :roomId`,
    { roomId, ...next, is_active: next.is_active ? 1 : 0 }
  );
  return (await query(`SELECT * FROM chat_rooms WHERE id = :roomId LIMIT 1`, { roomId }))[0];
}

async function deleteRoomAdmin(roomId) {
  await query(`UPDATE chat_rooms SET is_active = 0, updated_at = NOW() WHERE id = :roomId`, { roomId });
  return { id: Number(roomId), deleted: true };
}

async function listReportsAdmin() {
  return query(
    `SELECT mr.*, cm.content AS message_content, cm.room_id, u.display_name AS reported_by_name,
            target.display_name AS message_author_name, cr.name AS room_name
     FROM message_reports mr
     INNER JOIN chat_messages cm ON cm.id = mr.message_id
     INNER JOIN users u ON u.id = mr.reported_by_user_id
     INNER JOIN users target ON target.id = cm.user_id
     INNER JOIN chat_rooms cr ON cr.id = cm.room_id
     ORDER BY mr.created_at DESC`
  );
}

async function deleteMessageAdmin(messageId) {
  await query(
    `UPDATE chat_messages SET is_deleted = 1, deleted_at = NOW() WHERE id = :messageId`,
    { messageId }
  );
  return { id: Number(messageId), deleted: true };
}

module.exports = {
  listRooms,
  getRoomMessages,
  sendMessage,
  listRoomsAdmin,
  getRoomMessagesAdmin,
  createRoomAdmin,
  updateRoomAdmin,
  deleteRoomAdmin,
  listReportsAdmin,
  deleteMessageAdmin,
};
