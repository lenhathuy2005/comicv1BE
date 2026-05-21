const { query, queryWithConn, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

const GUILD_CHECKIN_REWARD_GOLD = 200;
const GUILD_CHECKIN_EXP_GAIN = 50;
const GUILD_CONTRIBUTION_GOLD_COST = 200;
const GUILD_CONTRIBUTION_EXP_GAIN = 200;

function getNextLevelExp(level) {
  const safeLevel = Math.max(1, Number(level || 1));
  return safeLevel * 1000;
}


async function getGuildById(guildId) {
  const rows = await query(
    `
    SELECT
      g.*,
      u.display_name AS leader_name,
      u.avatar_url AS leader_avatar_url
    FROM guilds g
    LEFT JOIN users u ON u.id = g.leader_user_id
    WHERE g.id = :guildId
      AND g.guild_status <> 'disbanded'
    LIMIT 1
    `,
    { guildId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy bang hội');
  }

  return rows[0];
}

async function getActiveGuildMember(guildId, userId) {
  const rows = await query(
    `
    SELECT
      gm.*,
      gr.code AS role_code,
      gr.name AS role_name,
      gr.hierarchy_level,
      gr.can_manage_members,
      gr.can_approve_join,
      gr.can_post_notice,
      gr.can_manage_chat,
      gr.can_promote_members,
      gr.can_manage_guild
    FROM guild_members gm
    LEFT JOIN guild_roles gr ON gr.id = gm.guild_role_id
    WHERE gm.guild_id = :guildId
      AND gm.user_id = :userId
      AND gm.join_status = 'active'
    LIMIT 1
    `,
    { guildId, userId }
  );

  return rows[0] || null;
}

function normalizeGuildSlug(value, fallback = 'bang-hoi') {
  const from = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
  const to = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';
  let text = String(value || fallback).trim().toLowerCase();

  for (let i = 0; i < from.length; i += 1) {
    text = text.replaceAll(from[i], to[i]);
  }

  text = text
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return text || fallback;
}

async function getGuildChatRoomIdWithConn(conn, guildId) {
  const rows = await queryWithConn(
    conn,
    `SELECT id FROM chat_rooms WHERE room_type = 'guild' AND linked_guild_id = :guildId LIMIT 1`,
    { guildId }
  );
  return rows[0]?.id || null;
}

async function ensureGuildChatRoomWithConn(conn, guild) {
  const existingId = await getGuildChatRoomIdWithConn(conn, guild.id);
  if (existingId) return existingId;

  const code = `guild-${normalizeGuildSlug(guild.slug || guild.name)}-${guild.id}`;
  const [roomResult] = await conn.query(
    `
    INSERT INTO chat_rooms (
      room_type,
      name,
      code,
      description,
      linked_guild_id,
      is_active,
      created_by_user_id,
      created_at,
      updated_at
    )
    VALUES (
      'guild',
      :name,
      :code,
      :description,
      :guildId,
      1,
      :createdByUserId,
      NOW(),
      NOW()
    )
    `,
    {
      name: `Chat ${guild.name}`,
      code,
      description: `Kênh chat nội bộ bang ${guild.name}`,
      guildId: guild.id,
      createdByUserId: guild.leader_user_id || null,
    }
  );

  return roomResult.insertId;
}

async function ensureGuildChatRoom(guildId) {
  return transaction(async (conn) => {
    const rows = await queryWithConn(
      conn,
      `SELECT id, name, slug, leader_user_id FROM guilds WHERE id = :guildId LIMIT 1`,
      { guildId }
    );

    if (!rows.length) return null;

    return ensureGuildChatRoomWithConn(conn, rows[0]);
  });
}

async function upsertGuildChatMemberWithConn(conn, guildId, userId, memberRole = 'member') {
  const roomId = await getGuildChatRoomIdWithConn(conn, guildId);
  if (!roomId) return null;

  await conn.query(
    `
    INSERT INTO chat_room_members (
      room_id,
      user_id,
      member_role,
      joined_at,
      is_active
    )
    VALUES (
      :roomId,
      :userId,
      :memberRole,
      NOW(),
      1
    )
    ON DUPLICATE KEY UPDATE
      member_role = VALUES(member_role),
      is_active = 1,
      muted_until = NULL
    `,
    { roomId, userId, memberRole }
  );

  return roomId;
}

function buildPermissions(member) {
  if (!member) {
    return {
      can_manage_members: false,
      can_approve_join: false,
      can_post_notice: false,
      can_manage_chat: false,
      can_promote_members: false,
      can_manage_guild: false,
    };
  }

  return {
    can_manage_members: Boolean(member.can_manage_members),
    can_approve_join: Boolean(member.can_approve_join),
    can_post_notice: Boolean(member.can_post_notice),
    can_manage_chat: Boolean(member.can_manage_chat),
    can_promote_members: Boolean(member.can_promote_members),
    can_manage_guild: Boolean(member.can_manage_guild),
  };
}

async function ensureCanApproveJoin(guildId, userId) {
  const member = await getActiveGuildMember(guildId, userId);

  if (!member) {
    throw new ApiError(403, 'Bạn không thuộc bang hội này');
  }

  if (!Boolean(member.can_approve_join) && !Boolean(member.can_manage_guild)) {
    throw new ApiError(403, 'Bạn không có quyền duyệt đơn vào bang');
  }

  return member;
}

async function ensureCanManageGuild(guildId, userId) {
  const member = await getActiveGuildMember(guildId, userId);

  if (!member) {
    throw new ApiError(403, 'Bạn không thuộc bang hội này');
  }

  if (!Boolean(member.can_manage_guild)) {
    throw new ApiError(403, 'Bạn không có quyền quản lý bang');
  }

  return member;
}

async function ensureCanPostNotice(guildId, userId) {
  const member = await getActiveGuildMember(guildId, userId);

  if (!member) {
    throw new ApiError(403, 'Bạn không thuộc bang hội này');
  }

  if (!Boolean(member.can_post_notice) && !Boolean(member.can_manage_guild)) {
    throw new ApiError(403, 'Bạn không có quyền đăng thông báo');
  }

  return member;
}

async function listGuilds() {
  return query(
    `
    SELECT
      g.*,
      u.display_name AS leader_name,
      (
        SELECT COUNT(*)
        FROM guild_members gm
        WHERE gm.guild_id = g.id
          AND gm.join_status = 'active'
      ) AS member_count
    FROM guilds g
    LEFT JOIN users u ON u.id = g.leader_user_id
    WHERE g.guild_status = 'active'
    ORDER BY g.id DESC
    `
  );
}

async function getGuildDetail(guildId) {
  return getGuildById(guildId);
}

async function getGuildDetailAggregate(guildId, currentUserId = null) {
  const guild = await getGuildById(guildId);

  const [memberCountRows, topMembers, latestAnnouncements, latestLogs, latestDonations, myMember] = await Promise.all([
    query(
      `
      SELECT COUNT(*) AS total
      FROM guild_members
      WHERE guild_id = :guildId
        AND join_status = 'active'
      `,
      { guildId }
    ),
    query(
      `
      SELECT
        gm.user_id,
        gm.contribution_points,
        gm.joined_at,
        u.display_name,
        u.avatar_url,
        gr.name AS role_name
      FROM guild_members gm
      LEFT JOIN users u ON u.id = gm.user_id
      LEFT JOIN guild_roles gr ON gr.id = gm.guild_role_id
      WHERE gm.guild_id = :guildId
        AND gm.join_status = 'active'
      ORDER BY gm.contribution_points DESC, gm.joined_at ASC
      LIMIT 5
      `,
      { guildId }
    ),
    query(
      `
      SELECT
        ga.id,
        ga.title,
        ga.content,
        ga.posted_by_user_id,
        ga.created_at,
        u.display_name AS posted_by_name
      FROM guild_announcements ga
      LEFT JOIN users u ON u.id = ga.posted_by_user_id
      WHERE ga.guild_id = :guildId
      ORDER BY ga.created_at DESC
      LIMIT 5
      `,
      { guildId }
    ),
    query(
      `
      SELECT
        gl.id,
        gl.action_type,
        gl.details,
        gl.created_at,
        gl.user_id,
        actor.display_name AS actor_name,
        gl.target_user_id,
        target.display_name AS target_user_name
      FROM guild_logs gl
      LEFT JOIN users actor ON actor.id = gl.user_id
      LEFT JOIN users target ON target.id = gl.target_user_id
      WHERE gl.guild_id = :guildId
      ORDER BY gl.created_at DESC
      LIMIT 10
      `,
      { guildId }
    ),
    query(
      `
      SELECT
        gd.id,
        gd.donation_type,
        gd.amount,
        gd.quantity,
        gd.note,
        gd.donated_at,
        gd.user_id,
        u.display_name AS donor_name,
        i.name AS item_name
      FROM guild_donations gd
      LEFT JOIN users u ON u.id = gd.user_id
      LEFT JOIN items i ON i.id = gd.item_id
      WHERE gd.guild_id = :guildId
      ORDER BY gd.donated_at DESC
      LIMIT 10
      `,
      { guildId }
    ),
    currentUserId ? getActiveGuildMember(guildId, currentUserId) : Promise.resolve(null),
  ]);

  const memberCount = Number(memberCountRows[0]?.total || 0);

  await ensureGuildChatRoom(guildId);

  const chatRoomRows = await query(
    `
    SELECT id
    FROM chat_rooms
    WHERE room_type = 'guild'
      AND linked_guild_id = :guildId
    LIMIT 1
    `,
    { guildId }
  );

  return {
    guild: {
      id: guild.id,
      name: guild.name,
      slug: guild.slug,
      logo_url: guild.logo_url,
      description: guild.description,
      announcement: guild.announcement,
      join_requirement_text: guild.join_requirement_text || null,
      join_min_level: Number(guild.join_min_level || 1),
      join_min_power: Number(guild.join_min_power || 0),
      member_limit: Number(guild.member_limit || 0),
      level: Number(guild.level || 0),
      current_exp: Number(guild.current_exp || 0),
      next_level_exp: Number(guild.next_level_exp || getNextLevelExp(guild.level || 1)),
      contribution_points: Number(guild.contribution_points || 0),
      guild_power: Number(guild.guild_power || 0),
      guild_status: guild.guild_status,
      created_at: guild.created_at,
      updated_at: guild.updated_at,
    },
    leader: {
      user_id: guild.leader_user_id,
      display_name: guild.leader_name,
      avatar_url: guild.leader_avatar_url,
    },
    member_count: memberCount,
    my_membership: myMember
      ? {
          is_member: true,
          guild_member_id: myMember.id,
          role_code: myMember.role_code,
          role_name: myMember.role_name,
          join_status: myMember.join_status,
          joined_at: myMember.joined_at,
          contribution_points: Number(myMember.contribution_points || 0),
          permissions: buildPermissions(myMember),
        }
      : {
          is_member: false,
          permissions: buildPermissions(null),
        },
    top_members: topMembers,
    latest_announcements: latestAnnouncements,
    latest_logs: latestLogs,
    latest_donations: latestDonations,
    chat_room_id: chatRoomRows[0]?.id || null,
  };
}


async function getMyGuildProfile(userId) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  const rows = await query(
    `
    SELECT gm.guild_id
    FROM guild_members gm
    INNER JOIN guilds g ON g.id = gm.guild_id AND g.guild_status = 'active'
    WHERE gm.user_id = :userId
      AND gm.join_status = 'active'
    ORDER BY gm.joined_at DESC
    LIMIT 1
    `,
    { userId }
  );

  if (!rows.length) {
    return null;
  }

  return getGuildDetailAggregate(rows[0].guild_id, userId);
}


async function getSystemConfigValue(configKey) {
  const rows = await query(
    `SELECT config_value, value_type FROM system_configs WHERE config_key = :configKey LIMIT 1`,
    { configKey }
  );
  if (!rows.length) return null;
  const row = rows[0];
  if (row.value_type === 'int') return Number(row.config_value || 0);
  if (row.value_type === 'decimal') return Number(row.config_value || 0);
  if (row.value_type === 'bool') return String(row.config_value) === '1' || String(row.config_value).toLowerCase() === 'true';
  if (row.value_type === 'json') {
    try { return JSON.parse(row.config_value); } catch (_error) { return row.config_value; }
  }
  return row.config_value;
}

async function getGuildCreationRequirements() {
  const [minLevel, goldCost] = await Promise.all([
    getSystemConfigValue('guild_create_min_level'),
    getSystemConfigValue('guild_create_gold_cost'),
  ]);

  return {
    min_level: Number(minLevel ?? 2),
    gold_cost: Number(goldCost ?? 5000),
  };
}



async function guildCheckinsTableExistsWithConn(conn) {
  const rows = await queryWithConn(
    conn,
    `
    SELECT COUNT(*) AS total
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'guild_checkins'
    `
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function hardDeleteGuildWithConn(conn, guildId) {
  const guildRows = await queryWithConn(
    conn,
    `SELECT id, name FROM guilds WHERE id = :guildId LIMIT 1`,
    { guildId }
  );

  if (!guildRows.length) {
    throw new ApiError(404, 'Không tìm thấy bang hội');
  }

  const guild = guildRows[0];

  await conn.query(
    `
    UPDATE users
    SET current_guild_id = NULL,
        updated_at = NOW()
    WHERE current_guild_id = :guildId
    `,
    { guildId }
  );

  const roomRows = await queryWithConn(
    conn,
    `SELECT id FROM chat_rooms WHERE room_type = 'guild' AND linked_guild_id = :guildId`,
    { guildId }
  );

  if (roomRows.length) {
    const roomIds = roomRows.map((room) => Number(room.id)).filter(Boolean);
    if (roomIds.length) {
      await conn.query(`DELETE FROM chat_room_members WHERE room_id IN (?)`, [roomIds]);
      await conn.query(`DELETE FROM chat_messages WHERE room_id IN (?)`, [roomIds]);
      await conn.query(`DELETE FROM chat_rooms WHERE id IN (?)`, [roomIds]);
    }
  }

  if (await guildCheckinsTableExistsWithConn(conn)) {
    await conn.query(`DELETE FROM guild_checkins WHERE guild_id = :guildId`, { guildId });
  }

  const contributionTableRows = await queryWithConn(
    conn,
    `
    SELECT COUNT(*) AS total
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'guild_daily_contributions'
    `
  );
  if (Number(contributionTableRows[0]?.total || 0) > 0) {
    await conn.query(`DELETE FROM guild_daily_contributions WHERE guild_id = :guildId`, { guildId });
  }

  await conn.query(`DELETE FROM guilds WHERE id = :guildId`, { guildId });

  return {
    id: Number(guildId),
    name: guild.name,
    deleted: true,
    hard_deleted: true,
    message: 'Bang hội đã được xoá khỏi hệ thống',
  };
}

async function ensureGuildCheckinTable() {
  await query(
    `
    CREATE TABLE IF NOT EXISTS guild_checkins (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      guild_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      checkin_date DATE NOT NULL,
      reward_gold DECIMAL(18,2) NOT NULL DEFAULT 200.00,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_guild_checkin_user_day (user_id, checkin_date),
      KEY idx_guild_checkins_guild_date (guild_id, checkin_date),
      KEY idx_guild_checkins_user_date (user_id, checkin_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  );
}


async function ensureGuildProgressColumnsWithConn(conn) {
  const columns = await queryWithConn(
    conn,
    `
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'guilds'
      AND COLUMN_NAME IN ('current_exp', 'next_level_exp')
    `
  );

  const names = new Set(columns.map((row) => row.COLUMN_NAME));

  if (!names.has('current_exp')) {
    await conn.query(
      `ALTER TABLE guilds ADD COLUMN current_exp BIGINT NOT NULL DEFAULT 0 AFTER level`
    );
  }

  if (!names.has('next_level_exp')) {
    await conn.query(
      `ALTER TABLE guilds ADD COLUMN next_level_exp BIGINT NOT NULL DEFAULT 1000 AFTER current_exp`
    );
  }
}


async function ensureGuildProfileColumnsWithConn(conn) {
  const columns = await queryWithConn(
    conn,
    `
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'guilds'
      AND COLUMN_NAME IN ('join_requirement_text', 'join_min_level', 'join_min_power')
    `
  );

  const names = new Set(columns.map((row) => row.COLUMN_NAME));

  if (!names.has('join_requirement_text')) {
    await conn.query(
      `ALTER TABLE guilds ADD COLUMN join_requirement_text TEXT NULL AFTER announcement`
    );
  }

  if (!names.has('join_min_level')) {
    await conn.query(
      `ALTER TABLE guilds ADD COLUMN join_min_level INT NOT NULL DEFAULT 1 AFTER join_requirement_text`
    );
  }

  if (!names.has('join_min_power')) {
    await conn.query(
      `ALTER TABLE guilds ADD COLUMN join_min_power BIGINT NOT NULL DEFAULT 0 AFTER join_min_level`
    );
  }
}

async function ensureGuildProfileColumns() {
  return transaction(async (conn) => ensureGuildProfileColumnsWithConn(conn));
}

function cleanNullableText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

async function ensureGuildContributionTable() {
  await query(
    `
    CREATE TABLE IF NOT EXISTS guild_daily_contributions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      guild_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      contribution_date DATE NOT NULL,
      gold_cost DECIMAL(18,2) NOT NULL DEFAULT 200.00,
      guild_exp_gain BIGINT NOT NULL DEFAULT 200,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_guild_contribution_user_day (user_id, contribution_date),
      KEY idx_guild_daily_contributions_guild_date (guild_id, contribution_date),
      KEY idx_guild_daily_contributions_user_date (user_id, contribution_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  );
}

async function applyGuildExpWithConn(
  conn,
  {
    guildId,
    expGain,
    contributionGain = 0,
    powerGain = 0,
  }
) {
  await ensureGuildProgressColumnsWithConn(conn);

  const rows = await queryWithConn(
    conn,
    `
    SELECT id, level, current_exp, next_level_exp
    FROM guilds
    WHERE id = :guildId
    LIMIT 1
    FOR UPDATE
    `,
    { guildId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy bang hội');
  }

  let level = Number(rows[0].level || 1);
  let currentExp = Number(rows[0].current_exp || 0) + Number(expGain || 0);
  let nextLevelExp = Number(rows[0].next_level_exp || getNextLevelExp(level));
  let levelUps = 0;

  if (nextLevelExp <= 0) nextLevelExp = getNextLevelExp(level);

  while (currentExp >= nextLevelExp) {
    currentExp -= nextLevelExp;
    level += 1;
    levelUps += 1;
    nextLevelExp = getNextLevelExp(level);
  }

  await conn.query(
    `
    UPDATE guilds
    SET level = :level,
        current_exp = :currentExp,
        next_level_exp = :nextLevelExp,
        contribution_points = COALESCE(contribution_points, 0) + :contributionGain,
        guild_power = COALESCE(guild_power, 0) + :powerGain,
        updated_at = NOW()
    WHERE id = :guildId
    `,
    {
      guildId,
      level,
      currentExp,
      nextLevelExp,
      contributionGain,
      powerGain,
    }
  );

  return {
    guild_exp_gain: Number(expGain || 0),
    contribution_gain: Number(contributionGain || 0),
    guild_power_gain: Number(powerGain || 0),
    guild_level: level,
    current_exp: currentExp,
    next_level_exp: nextLevelExp,
    level_ups: levelUps,
  };
}

async function getLeaderRoleIdWithConn(conn) {
  const roleRows = await queryWithConn(
    conn,
    `
    SELECT id
    FROM guild_roles
    ORDER BY
      CASE
        WHEN code = 'leader' THEN 0
        WHEN name = 'Bang chủ' THEN 1
        WHEN can_manage_guild = 1 THEN 2
        ELSE 9
      END ASC,
      hierarchy_level ASC
    LIMIT 1
    `
  );

  if (!roleRows.length) {
    throw new ApiError(500, 'Thiếu dữ liệu guild_roles');
  }

  return roleRows[0].id;
}

async function createGuild({ userId, name, slug = null, description = null }) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  const cleanName = String(name || '').trim();
  const cleanSlug = normalizeGuildSlug(slug || cleanName, 'bang-hoi');
  const cleanDescription = description ? String(description).trim() : null;

  if (!cleanName) {
    throw new ApiError(400, 'Tên bang hội là bắt buộc');
  }

  const requirements = await getGuildCreationRequirements();

  return transaction(async (conn) => {
    const existingGuild = await queryWithConn(
      conn,
      `
      SELECT id
      FROM guilds
      WHERE name = :name OR slug = :slug
      LIMIT 1
      `,
      { name: cleanName, slug: cleanSlug }
    );

    if (existingGuild.length) {
      throw new ApiError(400, 'Tên hoặc slug bang hội đã tồn tại');
    }

    const existingMember = await queryWithConn(
      conn,
      `
      SELECT id
      FROM guild_members
      WHERE user_id = :userId
        AND join_status = 'active'
      LIMIT 1
      `,
      { userId }
    );

    if (existingMember.length) {
      throw new ApiError(400, 'Bạn đã thuộc một bang hội');
    }

    const userRows = await queryWithConn(
      conn,
      `SELECT up.gold_balance, uc.current_level_id, lv.level_number
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN user_cultivation uc ON uc.user_id = u.id
       LEFT JOIN levels lv ON lv.id = uc.current_level_id
       WHERE u.id = :userId
       LIMIT 1`,
      { userId }
    );

    if (!userRows.length) {
      throw new ApiError(404, 'Không tìm thấy người dùng');
    }

    const user = userRows[0];
    const userLevel = Number(user.level_number || 0);
    const goldBalance = Number(user.gold_balance || 0);

    if (userLevel < requirements.min_level) {
      throw new ApiError(400, `Cần đạt cấp ${requirements.min_level} trở lên để tạo bang`);
    }

    if (goldBalance < requirements.gold_cost) {
      throw new ApiError(400, `Cần ${requirements.gold_cost} vàng để tạo bang`);
    }

    const leaderRoleId = await getLeaderRoleIdWithConn(conn);
    await ensureGuildProfileColumnsWithConn(conn);
    await ensureGuildProgressColumnsWithConn(conn);

    const [guildResult] = await conn.query(
      `
      INSERT INTO guilds (
        name,
        slug,
        description,
        join_requirement_text,
        join_min_level,
        join_min_power,
        leader_user_id,
        member_limit,
        level,
        current_exp,
        next_level_exp,
        contribution_points,
        guild_power,
        guild_status,
        created_at,
        updated_at
      )
      VALUES (
        :name,
        :slug,
        :description,
        'Cần được bang chủ duyệt để gia nhập',
        1,
        0,
        :userId,
        30,
        1,
        0,
        1000,
        0,
        0,
        'active',
        NOW(),
        NOW()
      )
      `,
      {
        name: cleanName,
        slug: cleanSlug,
        description: cleanDescription,
        userId,
      }
    );

    const guildId = guildResult.insertId;

    const chatRoomId = await ensureGuildChatRoomWithConn(conn, {
      id: guildId,
      name: cleanName,
      slug: cleanSlug,
      leader_user_id: userId,
    });

    await conn.query(
      `
      INSERT INTO guild_members (
        guild_id,
        user_id,
        guild_role_id,
        join_status,
        contribution_points,
        joined_at
      )
      VALUES (
        :guildId,
        :userId,
        :leaderRoleId,
        'active',
        0,
        NOW()
      )
      `,
      {
        guildId,
        userId,
        leaderRoleId,
      }
    );

    await upsertGuildChatMemberWithConn(conn, guildId, userId, 'owner');

    await conn.query(
      `UPDATE user_profiles SET gold_balance = GREATEST(COALESCE(gold_balance, 0) - :goldCost, 0), updated_at = NOW() WHERE user_id = :userId`,
      {
        goldCost: requirements.gold_cost,
        userId,
      }
    );

    await conn.query(
      `
      UPDATE users
      SET current_guild_id = :guildId,
          updated_at = NOW()
      WHERE id = :userId
      `,
      {
        guildId,
        userId,
      }
    );

    await conn.query(
      `
      INSERT INTO guild_logs (
        guild_id,
        user_id,
        action_type,
        details,
        created_at
      )
      VALUES (
        :guildId,
        :userId,
        'create',
        :details,
        NOW()
      )
      `,
      {
        guildId,
        userId,
        details: `Tạo bang hội - trừ ${requirements.gold_cost} vàng`,
      }
    );

    return {
      requirements,
      chat_room_id: chatRoomId,
      guild: {
        id: guildId,
        name: cleanName,
        slug: cleanSlug,
        description: cleanDescription,
        leader_user_id: userId,
        member_limit: 30,
        level: 1,
        current_exp: 0,
        next_level_exp: 1000,
        join_requirement_text: 'Cần được bang chủ duyệt để gia nhập',
        join_min_level: 1,
        join_min_power: 0,
        contribution_points: 0,
        guild_power: 0,
        guild_status: 'active',
      },
    };
  });
}

async function requestJoinGuild({ userId, guildId, requestMessage = null }) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  return transaction(async (conn) => {
    const memberRows = await queryWithConn(
      conn,
      `
      SELECT id
      FROM guild_members
      WHERE user_id = :userId
        AND join_status = 'active'
      LIMIT 1
      `,
      { userId }
    );

    if (memberRows.length) {
      throw new ApiError(400, 'Bạn đã thuộc một bang hội');
    }

    const pendingRows = await queryWithConn(
      conn,
      `
      SELECT id
      FROM guild_join_requests
      WHERE guild_id = :guildId
        AND user_id = :userId
        AND request_status = 'pending'
      LIMIT 1
      `,
      { guildId, userId }
    );

    if (pendingRows.length) {
      throw new ApiError(400, 'Bạn đã gửi yêu cầu tham gia bang hội này');
    }

    await ensureGuildProfileColumnsWithConn(conn);

    const guildRows = await queryWithConn(
      conn,
      `
      SELECT
        g.id,
        g.guild_status,
        g.member_limit,
        g.join_min_level,
        g.join_min_power,
        (
          SELECT COUNT(*)
          FROM guild_members gm
          WHERE gm.guild_id = g.id
            AND gm.join_status = 'active'
        ) AS active_member_count
      FROM guilds g
      WHERE g.id = :guildId
      LIMIT 1
      `,
      { guildId }
    );

    if (!guildRows.length) {
      throw new ApiError(404, 'Không tìm thấy bang hội');
    }

    const guild = guildRows[0];
    if (guild.guild_status !== 'active') {
      throw new ApiError(400, 'Bang hội này không còn nhận thành viên');
    }

    if (Number(guild.member_limit || 0) > 0 && Number(guild.active_member_count || 0) >= Number(guild.member_limit || 0)) {
      throw new ApiError(400, 'Bang hội đã đủ thành viên');
    }

    const userRows = await queryWithConn(
      conn,
      `
      SELECT
        COALESCE(lv.level_number, 0) AS level_number,
        GREATEST(COALESCE(uc.combat_power, 0), COALESCE(up.power_score, 0)) AS power_score
      FROM users u
      LEFT JOIN user_cultivation uc ON uc.user_id = u.id
      LEFT JOIN levels lv ON lv.id = uc.current_level_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = :userId
      LIMIT 1
      `,
      { userId }
    );

    const userLevel = Number(userRows[0]?.level_number || 0);
    const userPower = Number(userRows[0]?.power_score || 0);
    const minLevel = Number(guild.join_min_level || 1);
    const minPower = Number(guild.join_min_power || 0);

    if (userLevel < minLevel) {
      throw new ApiError(400, `Cần đạt cấp ${minLevel} trở lên để xin vào bang`);
    }

    if (userPower < minPower) {
      throw new ApiError(400, `Cần chiến lực tối thiểu ${minPower} để xin vào bang`);
    }

    await conn.query(
      `
      INSERT INTO guild_join_requests (
        guild_id,
        user_id,
        request_message,
        request_status,
        created_at
      )
      VALUES (
        :guildId,
        :userId,
        :requestMessage,
        'pending',
        NOW()
      )
      `,
      {
        guildId,
        userId,
        requestMessage,
      }
    );

    return {
      success: true,
      message: 'Gửi yêu cầu tham gia bang hội thành công',
    };
  });
}

async function approveJoinRequest({ reviewerUserId, requestId }) {
  if (!reviewerUserId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  return transaction(async (conn) => {
    const requestRows = await queryWithConn(
      conn,
      `
      SELECT *
      FROM guild_join_requests
      WHERE id = :requestId
      LIMIT 1
      `,
      { requestId }
    );

    if (!requestRows.length) {
      throw new ApiError(404, 'Không tìm thấy yêu cầu tham gia bang hội');
    }

    const request = requestRows[0];
    await ensureCanApproveJoin(request.guild_id, reviewerUserId);

    if (request.request_status !== 'pending') {
      throw new ApiError(400, 'Yêu cầu này không còn ở trạng thái pending');
    }

    const existingMember = await queryWithConn(
      conn,
      `
      SELECT id
      FROM guild_members
      WHERE user_id = :userId
        AND join_status = 'active'
      LIMIT 1
      `,
      { userId: request.user_id }
    );

    if (existingMember.length) {
      throw new ApiError(400, 'Người dùng đã thuộc một bang hội khác');
    }

    const memberRoleRows = await queryWithConn(
      conn,
      `
      SELECT id
      FROM guild_roles
      ORDER BY hierarchy_level DESC
      LIMIT 1
      `
    );

    if (!memberRoleRows.length) {
      throw new ApiError(500, 'Thiếu dữ liệu guild_roles');
    }

    const memberRoleId = memberRoleRows[0].id;

    await conn.query(
      `
      UPDATE guild_join_requests
      SET request_status = 'approved',
          reviewed_by_user_id = :reviewerUserId,
          reviewed_at = NOW()
      WHERE id = :requestId
      `,
      {
        reviewerUserId,
        requestId,
      }
    );

    await conn.query(
      `
      INSERT INTO guild_members (
        guild_id,
        user_id,
        guild_role_id,
        join_status,
        contribution_points,
        joined_at
      )
      VALUES (
        :guildId,
        :userId,
        :memberRoleId,
        'active',
        0,
        NOW()
      )
      `,
      {
        guildId: request.guild_id,
        userId: request.user_id,
        memberRoleId,
      }
    );

    await conn.query(
      `
      UPDATE users
      SET current_guild_id = :guildId,
          updated_at = NOW()
      WHERE id = :userId
      `,
      {
        guildId: request.guild_id,
        userId: request.user_id,
      }
    );

    const guildRowsForChat = await queryWithConn(
      conn,
      `SELECT id, name, slug, leader_user_id FROM guilds WHERE id = :guildId LIMIT 1`,
      { guildId: request.guild_id }
    );
    if (guildRowsForChat.length) {
      await ensureGuildChatRoomWithConn(conn, guildRowsForChat[0]);
    }
    await upsertGuildChatMemberWithConn(conn, request.guild_id, request.user_id, 'member');

    await conn.query(
      `
      INSERT INTO guild_logs (
        guild_id,
        user_id,
        action_type,
        target_user_id,
        details,
        created_at
      )
      VALUES (
        :guildId,
        :reviewerUserId,
        'approve_join',
        :targetUserId,
        'Phê duyệt tham gia bang hội',
        NOW()
      )
      `,
      {
        guildId: request.guild_id,
        reviewerUserId,
        targetUserId: request.user_id,
      }
    );

    return {
      success: true,
      message: 'Phê duyệt yêu cầu tham gia bang hội thành công',
    };
  });
}

async function rejectJoinRequest({ reviewerUserId, requestId }) {
  if (!reviewerUserId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  return transaction(async (conn) => {
    const requestRows = await queryWithConn(
      conn,
      `
      SELECT *
      FROM guild_join_requests
      WHERE id = :requestId
      LIMIT 1
      `,
      { requestId }
    );

    if (!requestRows.length) {
      throw new ApiError(404, 'Không tìm thấy yêu cầu tham gia bang hội');
    }

    const request = requestRows[0];
    await ensureCanApproveJoin(request.guild_id, reviewerUserId);

    if (request.request_status !== 'pending') {
      throw new ApiError(400, 'Yêu cầu này không còn ở trạng thái pending');
    }

    await conn.query(
      `
      UPDATE guild_join_requests
      SET request_status = 'rejected',
          reviewed_by_user_id = :reviewerUserId,
          reviewed_at = NOW()
      WHERE id = :requestId
      `,
      {
        reviewerUserId,
        requestId,
      }
    );

    await conn.query(
      `
      INSERT INTO guild_logs (
        guild_id,
        user_id,
        action_type,
        target_user_id,
        details,
        created_at
      )
      VALUES (
        :guildId,
        :reviewerUserId,
        'reject_join',
        :targetUserId,
        'Từ chối đơn xin vào bang',
        NOW()
      )
      `,
      {
        guildId: request.guild_id,
        reviewerUserId,
        targetUserId: request.user_id,
      }
    );

    return {
      success: true,
      message: 'Từ chối đơn xin vào bang thành công',
    };
  });
}

async function cancelJoinRequest({ guildId, userId }) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  const requestRows = await query(
    `
    SELECT id
    FROM guild_join_requests
    WHERE guild_id = :guildId
      AND user_id = :userId
      AND request_status = 'pending'
    LIMIT 1
    `,
    { guildId, userId }
  );

  if (!requestRows.length) {
    throw new ApiError(404, 'Không tìm thấy đơn chờ duyệt để hủy');
  }

  await query(
    `
    UPDATE guild_join_requests
    SET request_status = 'cancelled',
        reviewed_at = NOW()
    WHERE id = :requestId
    `,
    { requestId: requestRows[0].id }
  );

  return {
    success: true,
    message: 'Hủy đơn xin vào bang thành công',
  };
}

async function listGuildMembers(guildId) {
  return query(
    `
    SELECT
      gm.id,
      gm.guild_id,
      gm.user_id,
      gm.guild_role_id,
      gm.join_status,
      gm.contribution_points,
      gm.joined_at,
      u.username,
      u.display_name,
      u.avatar_url,
      gr.name AS role_name,
      gr.code AS role_code,
      gr.hierarchy_level,
      CASE
        WHEN g.leader_user_id = gm.user_id THEN 'Bang chủ'
        WHEN gr.name IS NOT NULL AND gr.name <> '' THEN gr.name
        ELSE 'Thành viên'
      END AS role,
      CASE
        WHEN g.leader_user_id = gm.user_id THEN 'leader'
        WHEN gr.code IS NOT NULL AND gr.code <> '' THEN gr.code
        ELSE 'member'
      END AS display_role_code
    FROM guild_members gm
    LEFT JOIN guilds g ON g.id = gm.guild_id
    LEFT JOIN users u ON u.id = gm.user_id
    LEFT JOIN guild_roles gr ON gr.id = gm.guild_role_id
    WHERE gm.guild_id = :guildId
      AND gm.join_status = 'active'
    ORDER BY
      CASE WHEN g.leader_user_id = gm.user_id THEN 0 ELSE 1 END ASC,
      gr.hierarchy_level ASC,
      gm.contribution_points DESC,
      gm.joined_at ASC
    `,
    { guildId }
  );
}

async function listGuildJoinRequests(guildId, userId) {
  await ensureCanApproveJoin(guildId, userId);

  const rows = await query(
    `
    SELECT
      gjr.*,
      u.username,
      u.display_name,
      u.avatar_url,
      reviewer.display_name AS reviewed_by_name
    FROM guild_join_requests gjr
    LEFT JOIN users u ON u.id = gjr.user_id
    LEFT JOIN users reviewer ON reviewer.id = gjr.reviewed_by_user_id
    WHERE gjr.guild_id = :guildId
    ORDER BY gjr.created_at DESC
    `,
    { guildId }
  );

  return { items: rows };
}

async function listGuildLogs(guildId) {
  const rows = await query(
    `
    SELECT
      gl.*,
      actor.display_name AS actor_name,
      target.display_name AS target_user_name
    FROM guild_logs gl
    LEFT JOIN users actor ON actor.id = gl.user_id
    LEFT JOIN users target ON target.id = gl.target_user_id
    WHERE gl.guild_id = :guildId
    ORDER BY gl.created_at DESC
    LIMIT 100
    `,
    { guildId }
  );

  return { items: rows };
}

async function listGuildDonations(guildId) {
  const rows = await query(
    `
    SELECT
      gd.*,
      u.display_name AS donor_name,
      i.name AS item_name
    FROM guild_donations gd
    LEFT JOIN users u ON u.id = gd.user_id
    LEFT JOIN items i ON i.id = gd.item_id
    WHERE gd.guild_id = :guildId
    ORDER BY gd.donated_at DESC
    LIMIT 100
    `,
    { guildId }
  );

  return { items: rows };
}

async function listGuildAnnouncements(guildId) {
  const rows = await query(
    `
    SELECT
      ga.*,
      u.display_name AS posted_by_name
    FROM guild_announcements ga
    LEFT JOIN users u ON u.id = ga.posted_by_user_id
    WHERE ga.guild_id = :guildId
    ORDER BY ga.created_at DESC
    LIMIT 100
    `,
    { guildId }
  );

  return { items: rows };
}

async function leaveGuild({ guildId, userId }) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  return transaction(async (conn) => {
    const guildRows = await queryWithConn(
      conn,
      `SELECT id, leader_user_id FROM guilds WHERE id = :guildId LIMIT 1`,
      { guildId }
    );

    if (!guildRows.length) {
      throw new ApiError(404, 'Không tìm thấy bang hội');
    }

    const guild = guildRows[0];

    if (Number(guild.leader_user_id) === Number(userId)) {
      throw new ApiError(400, 'Bang chủ chưa thể rời bang. Hãy chuyển quyền hoặc giải tán bang trước');
    }

    const memberRows = await queryWithConn(
      conn,
      `
      SELECT id
      FROM guild_members
      WHERE guild_id = :guildId
        AND user_id = :userId
        AND join_status = 'active'
      LIMIT 1
      `,
      { guildId, userId }
    );

    if (!memberRows.length) {
      throw new ApiError(404, 'Bạn không thuộc bang hội này');
    }

    await conn.query(
      `
      UPDATE guild_members
      SET join_status = 'left',
          left_at = NOW()
      WHERE id = :guildMemberId
      `,
      { guildMemberId: memberRows[0].id }
    );

    await conn.query(
      `
      UPDATE users
      SET current_guild_id = NULL,
          updated_at = NOW()
      WHERE id = :userId
      `,
      { userId }
    );

    const leaveChatRoomId = await getGuildChatRoomIdWithConn(conn, guildId);
    if (leaveChatRoomId) {
      await conn.query(
        `
        UPDATE chat_room_members
        SET is_active = 0
        WHERE room_id = :roomId
          AND user_id = :userId
        `,
        { roomId: leaveChatRoomId, userId }
      );
    }

    await conn.query(
      `
      INSERT INTO guild_logs (
        guild_id,
        user_id,
        action_type,
        details,
        created_at
      )
      VALUES (
        :guildId,
        :userId,
        'leave',
        'Rời bang hội',
        NOW()
      )
      `,
      { guildId, userId }
    );

    return {
      success: true,
      message: 'Rời bang hội thành công',
    };
  });
}


async function disbandGuild({ guildId, userId }) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  return transaction(async (conn) => {
    const guildRows = await queryWithConn(
      conn,
      `SELECT id, name, leader_user_id FROM guilds WHERE id = :guildId LIMIT 1`,
      { guildId }
    );

    if (!guildRows.length) {
      throw new ApiError(404, 'Không tìm thấy bang hội');
    }

    const guild = guildRows[0];

    if (Number(guild.leader_user_id) !== Number(userId)) {
      throw new ApiError(403, 'Chỉ bang chủ mới được giải tán bang hội');
    }

    return hardDeleteGuildWithConn(conn, guildId);
  });
}

async function checkinGuild({ guildId, userId }) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  await ensureGuildCheckinTable();

  const rewardGold = GUILD_CHECKIN_REWARD_GOLD;
  const guildExpGain = GUILD_CHECKIN_EXP_GAIN;

  return transaction(async (conn) => {
    const memberRows = await queryWithConn(
      conn,
      `
      SELECT gm.id, gm.guild_id, gm.user_id, gm.join_status, g.guild_status
      FROM guild_members gm
      INNER JOIN guilds g ON g.id = gm.guild_id
      WHERE gm.guild_id = :guildId
        AND gm.user_id = :userId
        AND gm.join_status = 'active'
      LIMIT 1
      `,
      { guildId, userId }
    );

    if (!memberRows.length) {
      throw new ApiError(403, 'Bạn cần tham gia bang hội này mới được điểm danh');
    }

    if (memberRows[0].guild_status !== 'active') {
      throw new ApiError(400, 'Bang hội không còn hoạt động');
    }

    const checkedRows = await queryWithConn(
      conn,
      `
      SELECT id, guild_id
      FROM guild_checkins
      WHERE user_id = :userId
        AND checkin_date = CURDATE()
      LIMIT 1
      `,
      { userId }
    );

    if (checkedRows.length) {
      throw new ApiError(
        400,
        'Hôm nay bạn đã điểm danh bang hội rồi. Mỗi tài khoản chỉ được điểm danh 1 lần/ngày.'
      );
    }

    await conn.query(
      `
      INSERT INTO guild_checkins (guild_id, user_id, checkin_date, reward_gold, created_at)
      VALUES (:guildId, :userId, CURDATE(), :rewardGold, NOW())
      `,
      { guildId, userId, rewardGold }
    );

    await conn.query(
      `
      INSERT INTO user_profiles (user_id, gold_balance, created_at, updated_at)
      VALUES (:userId, :rewardGold, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        gold_balance = COALESCE(gold_balance, 0) + VALUES(gold_balance),
        updated_at = NOW()
      `,
      { userId, rewardGold }
    );

    await conn.query(
      `
      UPDATE guild_members
      SET contribution_points = COALESCE(contribution_points, 0) + 1
      WHERE guild_id = :guildId
        AND user_id = :userId
        AND join_status = 'active'
      `,
      { guildId, userId }
    );

    const guildProgress = await applyGuildExpWithConn(conn, {
      guildId,
      expGain: guildExpGain,
      contributionGain: 1,
      powerGain: 0,
    });

    await conn.query(
      `
      INSERT INTO guild_logs (guild_id, user_id, action_type, details, created_at)
      VALUES (:guildId, :userId, 'checkin', :details, NOW())
      `,
      {
        guildId,
        userId,
        details: `Điểm danh bang hội, nhận ${rewardGold} vàng, bang hội +${guildExpGain} EXP`,
      }
    );

    return {
      success: true,
      checked_in: true,
      reward_gold: rewardGold,
      guild_exp_gain: guildExpGain,
      guild_progress: guildProgress,
      message: `Điểm danh thành công, nhận ${rewardGold} vàng, bang hội +${guildExpGain} EXP`,
    };
  });
}


async function contributeToGuild({ guildId, userId }) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  await ensureGuildContributionTable();

  const goldCost = GUILD_CONTRIBUTION_GOLD_COST;
  const guildExpGain = GUILD_CONTRIBUTION_EXP_GAIN;

  return transaction(async (conn) => {
    const memberRows = await queryWithConn(
      conn,
      `
      SELECT gm.id, gm.guild_id, gm.user_id, gm.join_status, g.guild_status
      FROM guild_members gm
      INNER JOIN guilds g ON g.id = gm.guild_id
      WHERE gm.guild_id = :guildId
        AND gm.user_id = :userId
        AND gm.join_status = 'active'
      LIMIT 1
      `,
      { guildId, userId }
    );

    if (!memberRows.length) {
      throw new ApiError(403, 'Bạn cần tham gia bang hội này mới được cống hiến');
    }

    if (memberRows[0].guild_status !== 'active') {
      throw new ApiError(400, 'Bang hội không còn hoạt động');
    }

    const contributedRows = await queryWithConn(
      conn,
      `
      SELECT id, guild_id
      FROM guild_daily_contributions
      WHERE user_id = :userId
        AND contribution_date = CURDATE()
      LIMIT 1
      `,
      { userId }
    );

    if (contributedRows.length) {
      throw new ApiError(
        400,
        'Hôm nay bạn đã cống hiến bang hội rồi. Mỗi tài khoản chỉ được cống hiến 1 lần/ngày.'
      );
    }

    const profileRows = await queryWithConn(
      conn,
      `
      SELECT user_id, gold_balance
      FROM user_profiles
      WHERE user_id = :userId
      LIMIT 1
      FOR UPDATE
      `,
      { userId }
    );

    if (!profileRows.length) {
      throw new ApiError(404, 'Không tìm thấy hồ sơ người dùng');
    }

    if (Number(profileRows[0].gold_balance || 0) < goldCost) {
      throw new ApiError(400, `Không đủ vàng để cống hiến. Cần ${goldCost} vàng.`);
    }

    await conn.query(
      `
      UPDATE user_profiles
      SET gold_balance = COALESCE(gold_balance, 0) - :goldCost,
          updated_at = NOW()
      WHERE user_id = :userId
      `,
      { userId, goldCost }
    );

    await conn.query(
      `
      INSERT INTO guild_daily_contributions (
        guild_id,
        user_id,
        contribution_date,
        gold_cost,
        guild_exp_gain,
        created_at
      )
      VALUES (
        :guildId,
        :userId,
        CURDATE(),
        :goldCost,
        :guildExpGain,
        NOW()
      )
      `,
      { guildId, userId, goldCost, guildExpGain }
    );

    await conn.query(
      `
      UPDATE guild_members
      SET contribution_points = COALESCE(contribution_points, 0) + :guildExpGain
      WHERE guild_id = :guildId
        AND user_id = :userId
        AND join_status = 'active'
      `,
      { guildId, userId, guildExpGain }
    );

    const guildProgress = await applyGuildExpWithConn(conn, {
      guildId,
      expGain: guildExpGain,
      contributionGain: guildExpGain,
      powerGain: guildExpGain,
    });

    await conn.query(
      `
      INSERT INTO guild_donations (
        guild_id,
        user_id,
        donation_type,
        item_id,
        quantity,
        amount,
        donated_at,
        note
      )
      VALUES (
        :guildId,
        :userId,
        'gold',
        NULL,
        0,
        :goldCost,
        NOW(),
        'Cống hiến bang hội hằng ngày'
      )
      `,
      { guildId, userId, goldCost }
    );

    await conn.query(
      `
      INSERT INTO guild_logs (guild_id, user_id, action_type, details, created_at)
      VALUES (:guildId, :userId, 'daily_contribution', :details, NOW())
      `,
      {
        guildId,
        userId,
        details: `Cống hiến ${goldCost} vàng, bang hội +${guildExpGain} EXP`,
      }
    );

    return {
      success: true,
      gold_cost: goldCost,
      guild_exp_gain: guildExpGain,
      contribution_gain: guildExpGain,
      guild_progress: guildProgress,
      message: `Cống hiến thành công ${goldCost} vàng, bang hội +${guildExpGain} EXP`,
    };
  });
}

async function updateGuild({
  guildId,
  userId,
  name,
  slug,
  logoUrl,
  description,
  announcement,
  memberLimit,
  joinRequirementText,
  joinMinLevel,
  joinMinPower,
  guildStatus,
}) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  return transaction(async (conn) => {
    await ensureGuildProfileColumnsWithConn(conn);
    await ensureCanManageGuild(guildId, userId);

    const guildRows = await queryWithConn(
      conn,
      `SELECT * FROM guilds WHERE id = :guildId LIMIT 1 FOR UPDATE`,
      { guildId }
    );

    if (!guildRows.length) {
      throw new ApiError(404, 'Không tìm thấy bang hội');
    }

    const guild = guildRows[0];
    const nextName = name !== undefined ? String(name).trim() : guild.name;
    const nextSlug = slug !== undefined && String(slug).trim().length > 0
      ? normalizeGuildSlug(slug, guild.slug)
      : normalizeGuildSlug(nextName, guild.slug);
    const nextLogoUrl = logoUrl !== undefined ? cleanNullableText(logoUrl) : guild.logo_url;
    const nextDescription = description !== undefined ? cleanNullableText(description) : guild.description;
    const nextAnnouncement = announcement !== undefined ? cleanNullableText(announcement) : guild.announcement;
    const nextMemberLimit = memberLimit !== undefined ? Number(memberLimit) : Number(guild.member_limit);
    const nextJoinRequirementText = joinRequirementText !== undefined
      ? cleanNullableText(joinRequirementText)
      : guild.join_requirement_text;
    const nextJoinMinLevel = joinMinLevel !== undefined ? Number(joinMinLevel) : Number(guild.join_min_level || 1);
    const nextJoinMinPower = joinMinPower !== undefined ? Number(joinMinPower) : Number(guild.join_min_power || 0);
    const nextGuildStatus = guildStatus ?? guild.guild_status;

    if (!nextName) {
      throw new ApiError(400, 'Tên bang hội là bắt buộc');
    }

    if (!nextSlug) {
      throw new ApiError(400, 'slug là bắt buộc');
    }

    if (Number.isNaN(nextMemberLimit) || nextMemberLimit <= 0) {
      throw new ApiError(400, 'Giới hạn thành viên phải lớn hơn 0');
    }

    if (Number.isNaN(nextJoinMinLevel) || nextJoinMinLevel < 1) {
      throw new ApiError(400, 'Cấp yêu cầu vào bang phải từ 1 trở lên');
    }

    if (Number.isNaN(nextJoinMinPower) || nextJoinMinPower < 0) {
      throw new ApiError(400, 'Chiến lực yêu cầu vào bang không hợp lệ');
    }

    const allowedStatuses = ['active', 'locked'];
    if (!allowedStatuses.includes(nextGuildStatus)) {
      throw new ApiError(400, 'guildStatus không hợp lệ');
    }

    const duplicateRows = await queryWithConn(
      conn,
      `
      SELECT id
      FROM guilds
      WHERE id <> :guildId
        AND (name = :name OR slug = :slug)
      LIMIT 1
      `,
      {
        guildId,
        name: nextName,
        slug: nextSlug,
      }
    );

    if (duplicateRows.length) {
      throw new ApiError(400, 'Tên hoặc slug bang hội đã tồn tại');
    }

    await conn.query(
      `
      UPDATE guilds
      SET name = :name,
          slug = :slug,
          logo_url = :logoUrl,
          description = :description,
          announcement = :announcement,
          member_limit = :memberLimit,
          join_requirement_text = :joinRequirementText,
          join_min_level = :joinMinLevel,
          join_min_power = :joinMinPower,
          guild_status = :guildStatus,
          updated_at = NOW()
      WHERE id = :guildId
      `,
      {
        guildId,
        name: nextName,
        slug: nextSlug,
        logoUrl: nextLogoUrl,
        description: nextDescription,
        announcement: nextAnnouncement,
        memberLimit: nextMemberLimit,
        joinRequirementText: nextJoinRequirementText,
        joinMinLevel: nextJoinMinLevel,
        joinMinPower: nextJoinMinPower,
        guildStatus: nextGuildStatus,
      }
    );

    const roomId = await getGuildChatRoomIdWithConn(conn, guildId);
    if (roomId) {
      await conn.query(
        `
        UPDATE chat_rooms
        SET name = :name,
            description = :description,
            updated_at = NOW()
        WHERE id = :roomId
        `,
        {
          roomId,
          name: `Chat ${nextName}`,
          description: `Kênh chat nội bộ bang ${nextName}`,
        }
      );
    }

    await conn.query(
      `
      INSERT INTO guild_logs (guild_id, user_id, action_type, details, created_at)
      VALUES (:guildId, :userId, 'update_profile', 'Cập nhật hồ sơ và yêu cầu vào bang', NOW())
      `,
      { guildId, userId }
    );

    return getGuildDetailAggregate(guildId, userId);
  });
}

async function updateGuildMemberRole({ guildId, memberId, actorUserId, roleCode }) {
  if (!actorUserId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  const normalizedRoleCode = String(roleCode || '').trim().toLowerCase();
  const allowedRoleCodes = ['vice_leader', 'elder', 'member'];

  if (!allowedRoleCodes.includes(normalizedRoleCode)) {
    throw new ApiError(400, 'Chức vụ không hợp lệ. Chỉ được chọn Phó bang, Trưởng lão hoặc Thành viên.');
  }

  return transaction(async (conn) => {
    const guildRows = await queryWithConn(
      conn,
      `SELECT id, leader_user_id FROM guilds WHERE id = :guildId AND guild_status = 'active' LIMIT 1`,
      { guildId }
    );

    if (!guildRows.length) {
      throw new ApiError(404, 'Không tìm thấy bang hội');
    }

    const guild = guildRows[0];
    if (Number(guild.leader_user_id) !== Number(actorUserId)) {
      throw new ApiError(403, 'Chỉ bang chủ mới được nâng/hạ chức thành viên');
    }

    const memberRows = await queryWithConn(
      conn,
      `
      SELECT gm.id, gm.user_id, gm.guild_role_id, u.display_name
      FROM guild_members gm
      LEFT JOIN users u ON u.id = gm.user_id
      WHERE gm.id = :memberId
        AND gm.guild_id = :guildId
        AND gm.join_status = 'active'
      LIMIT 1
      `,
      { guildId, memberId }
    );

    if (!memberRows.length) {
      throw new ApiError(404, 'Không tìm thấy thành viên trong bang');
    }

    const member = memberRows[0];
    if (Number(member.user_id) === Number(guild.leader_user_id)) {
      throw new ApiError(400, 'Không thể đổi chức vụ của bang chủ');
    }

    const roleRows = await queryWithConn(
      conn,
      `SELECT id, code, name FROM guild_roles WHERE code = :roleCode LIMIT 1`,
      { roleCode: normalizedRoleCode }
    );

    if (!roleRows.length) {
      throw new ApiError(500, 'Thiếu dữ liệu chức vụ bang hội');
    }

    const role = roleRows[0];

    await conn.query(
      `
      UPDATE guild_members
      SET guild_role_id = :roleId
      WHERE id = :memberId
      `,
      { roleId: role.id, memberId }
    );

    const roomId = await getGuildChatRoomIdWithConn(conn, guildId);
    if (roomId) {
      const chatRole = normalizedRoleCode === 'vice_leader'
        ? 'moderator'
        : normalizedRoleCode === 'elder'
          ? 'moderator'
          : 'member';

      await conn.query(
        `
        UPDATE chat_room_members
        SET member_role = :chatRole,
            is_active = 1
        WHERE room_id = :roomId
          AND user_id = :targetUserId
        `,
        {
          chatRole,
          roomId,
          targetUserId: member.user_id,
        }
      );
    }

    await conn.query(
      `
      INSERT INTO guild_logs (guild_id, user_id, action_type, target_user_id, details, created_at)
      VALUES (:guildId, :actorUserId, 'change_member_role', :targetUserId, :details, NOW())
      `,
      {
        guildId,
        actorUserId,
        targetUserId: member.user_id,
        details: `Đổi chức vụ ${member.display_name || member.user_id} thành ${role.name}`,
      }
    );

    return {
      success: true,
      member_id: Number(memberId),
      user_id: Number(member.user_id),
      role_code: role.code,
      role_name: role.name,
      message: `Đã đổi chức vụ thành ${role.name}`,
    };
  });
}

async function updateGuildAnnouncement({ guildId, userId, announcement, title = 'Thông báo bang hội' }) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  if (!announcement || !announcement.trim()) {
    throw new ApiError(400, 'announcement là bắt buộc');
  }

  await ensureCanPostNotice(guildId, userId);

  await query(
    `
    UPDATE guilds
    SET announcement = :announcement,
        updated_at = NOW()
    WHERE id = :guildId
    `,
    {
      guildId,
      announcement: announcement.trim(),
    }
  );

  await query(
    `
    INSERT INTO guild_announcements (
      guild_id,
      title,
      content,
      posted_by_user_id,
      created_at,
      updated_at
    )
    VALUES (
      :guildId,
      :title,
      :announcement,
      :userId,
      NOW(),
      NOW()
    )
    `,
    {
      guildId,
      title: title?.trim?.() || 'Thông báo bang hội',
      announcement: announcement.trim(),
      userId,
    }
  );

  await query(
    `
    INSERT INTO guild_logs (
      guild_id,
      user_id,
      action_type,
      details,
      created_at
    )
    VALUES (
      :guildId,
      :userId,
      'announcement',
      'Cập nhật thông báo bang hội',
      NOW()
    )
    `,
    { guildId, userId }
  );

  return getGuildDetail(guildId);
}

async function donateToGuild({
  guildId,
  userId,
  donationType = 'gold',
  amount = 0,
  itemId = null,
  quantity = 0,
  note = null,
}) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  const allowedTypes = ['gold', 'premium_currency', 'item', 'spirit_stone'];

  if (!allowedTypes.includes(donationType)) {
    throw new ApiError(400, 'donationType không hợp lệ');
  }

  return transaction(async (conn) => {
    const guildRows = await queryWithConn(
      conn,
      `
      SELECT id, guild_power, contribution_points, guild_status
      FROM guilds
      WHERE id = :guildId
      LIMIT 1
      `,
      { guildId }
    );

    if (!guildRows.length) {
      throw new ApiError(404, 'Không tìm thấy bang hội');
    }

    const guild = guildRows[0];

    if (guild.guild_status !== 'active') {
      throw new ApiError(400, 'Bang hội không ở trạng thái active');
    }

    const memberRows = await queryWithConn(
      conn,
      `
      SELECT id
      FROM guild_members
      WHERE guild_id = :guildId
        AND user_id = :userId
        AND join_status = 'active'
      LIMIT 1
      `,
      { guildId, userId }
    );

    if (!memberRows.length) {
      throw new ApiError(403, 'Bạn không thuộc bang hội này');
    }

    let guildPowerIncrease = 0;
    let contributionIncrease = 0;
    const numericAmount = Number(amount || 0);
    const numericQuantity = Number(quantity || 0);

    if (donationType === 'gold' || donationType === 'premium_currency') {
      if (numericAmount <= 0) {
        throw new ApiError(400, 'amount phải lớn hơn 0');
      }

      const profileRows = await queryWithConn(
        conn,
        `
        SELECT id, gold_balance, premium_currency
        FROM user_profiles
        WHERE user_id = :userId
        LIMIT 1
        `,
        { userId }
      );

      if (!profileRows.length) {
        throw new ApiError(404, 'Không tìm thấy hồ sơ người dùng');
      }

      const profile = profileRows[0];

      if (donationType === 'gold') {
        if (Number(profile.gold_balance) < numericAmount) {
          throw new ApiError(400, 'Không đủ vàng');
        }

        await conn.query(
          `
          UPDATE user_profiles
          SET gold_balance = gold_balance - :amount,
              updated_at = NOW()
          WHERE user_id = :userId
          `,
          { amount: numericAmount, userId }
        );
      } else {
        if (Number(profile.premium_currency) < numericAmount) {
          throw new ApiError(400, 'Không đủ premium currency');
        }

        await conn.query(
          `
          UPDATE user_profiles
          SET premium_currency = premium_currency - :amount,
              updated_at = NOW()
          WHERE user_id = :userId
          `,
          { amount: numericAmount, userId }
        );
      }

      contributionIncrease = numericAmount;
      guildPowerIncrease = numericAmount;
    }

    if (donationType === 'spirit_stone') {
      if (numericAmount <= 0) {
        throw new ApiError(400, 'amount phải lớn hơn 0');
      }

      const cultivationRows = await queryWithConn(
        conn,
        `
        SELECT id, spirit_stones
        FROM user_cultivation
        WHERE user_id = :userId
        LIMIT 1
        `,
        { userId }
      );

      if (!cultivationRows.length) {
        throw new ApiError(404, 'Không tìm thấy dữ liệu tu luyện');
      }

      const cultivation = cultivationRows[0];

      if (Number(cultivation.spirit_stones) < numericAmount) {
        throw new ApiError(400, 'Không đủ spirit stones');
      }

      await conn.query(
        `
        UPDATE user_cultivation
        SET spirit_stones = spirit_stones - :amount,
            updated_at = NOW()
        WHERE user_id = :userId
        `,
        { amount: numericAmount, userId }
      );

      contributionIncrease = numericAmount;
      guildPowerIncrease = numericAmount;
    }

    if (donationType === 'item') {
      if (!itemId) {
        throw new ApiError(400, 'itemId là bắt buộc khi donationType = item');
      }

      if (numericQuantity <= 0) {
        throw new ApiError(400, 'quantity phải lớn hơn 0');
      }

      const inventoryRows = await queryWithConn(
        conn,
        `
        SELECT id, quantity
        FROM user_inventory
        WHERE user_id = :userId
          AND item_id = :itemId
        LIMIT 1
        `,
        { userId, itemId }
      );

      if (!inventoryRows.length) {
        throw new ApiError(404, 'Không tìm thấy item trong túi đồ');
      }

      const inventory = inventoryRows[0];

      if (Number(inventory.quantity) < numericQuantity) {
        throw new ApiError(400, 'Không đủ số lượng item để donate');
      }

      await conn.query(
        `
        UPDATE user_inventory
        SET quantity = quantity - :quantity,
            updated_at = NOW()
        WHERE id = :inventoryId
        `,
        {
          quantity: numericQuantity,
          inventoryId: inventory.id,
        }
      );

      contributionIncrease = numericQuantity;
      guildPowerIncrease = numericQuantity;
    }

    await conn.query(
      `
      UPDATE guilds
      SET contribution_points = contribution_points + :contributionIncrease,
          guild_power = guild_power + :guildPowerIncrease,
          updated_at = NOW()
      WHERE id = :guildId
      `,
      {
        contributionIncrease,
        guildPowerIncrease,
        guildId,
      }
    );

    await conn.query(
      `
      UPDATE guild_members
      SET contribution_points = contribution_points + :contributionIncrease
      WHERE guild_id = :guildId
        AND user_id = :userId
        AND join_status = 'active'
      `,
      {
        contributionIncrease,
        guildId,
        userId,
      }
    );

    await conn.query(
      `
      INSERT INTO guild_donations (
        guild_id,
        user_id,
        donation_type,
        item_id,
        quantity,
        amount,
        donated_at,
        note
      )
      VALUES (
        :guildId,
        :userId,
        :donationType,
        :itemId,
        :quantity,
        :amount,
        NOW(),
        :note
      )
      `,
      {
        guildId,
        userId,
        donationType,
        itemId,
        quantity: numericQuantity,
        amount: numericAmount,
        note,
      }
    );

    await conn.query(
      `
      INSERT INTO guild_logs (
        guild_id,
        user_id,
        action_type,
        details,
        created_at
      )
      VALUES (
        :guildId,
        :userId,
        'donate',
        :details,
        NOW()
      )
      `,
      {
        guildId,
        userId,
        details: `Donation type=${donationType}, amount=${numericAmount}, quantity=${numericQuantity}`,
      }
    );

    return {
      success: true,
      message: 'Đóng góp bang hội thành công',
      contribution_increase: contributionIncrease,
      guild_power_increase: guildPowerIncrease,
    };
  });
}

module.exports = {
  listGuilds,
  getMyGuildProfile,
  getGuildDetail,
  getGuildDetailAggregate,
  getGuildCreationRequirements,
  createGuild,
  requestJoinGuild,
  approveJoinRequest,
  rejectJoinRequest,
  cancelJoinRequest,
  listGuildMembers,
  listGuildJoinRequests,
  listGuildLogs,
  listGuildDonations,
  listGuildAnnouncements,
  leaveGuild,
  disbandGuild,
  checkinGuild,
  contributeToGuild,
  updateGuild,
  updateGuildMemberRole,
  updateGuildAnnouncement,
  donateToGuild,
};
