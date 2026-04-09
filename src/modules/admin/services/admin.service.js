const { query, queryWithConn, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');
const { hashPassword } = require('../../../utils/password.util');

function toInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function toNullableInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toNullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function normalizeBool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

async function findRoleIdByCode(roleCode = 'user', conn = null) {
  const sql = 'SELECT id FROM roles WHERE code = :roleCode LIMIT 1';
  const rows = conn ? await queryWithConn(conn, sql, { roleCode }) : await query(sql, { roleCode });
  if (!rows.length) throw new ApiError(400, `Không tìm thấy role ${roleCode}`);
  return rows[0].id;
}

async function getFirstId(table, orderColumn, conn = null) {
  const sql = `SELECT id FROM ${table} ORDER BY ${orderColumn} ASC LIMIT 1`;
  const rows = conn ? await queryWithConn(conn, sql) : await query(sql);
  return rows[0]?.id || null;
}

async function getDashboard() {
  const [users, comics, chapters, guilds, items, rooms, notifications, comments, vipLevels, missions, afkRunning] = await Promise.all([
    query(`SELECT COUNT(*) AS total,
                  SUM(CASE WHEN account_status = 'active' THEN 1 ELSE 0 END) AS active,
                  SUM(CASE WHEN account_status IN ('banned','suspended') THEN 1 ELSE 0 END) AS blocked
           FROM users
           WHERE deleted_at IS NULL`),
    query(`SELECT COUNT(*) AS total,
                  SUM(CASE WHEN publication_status = 'ongoing' THEN 1 ELSE 0 END) AS ongoing,
                  SUM(CASE WHEN publication_status = 'completed' THEN 1 ELSE 0 END) AS completed
           FROM comics WHERE deleted_at IS NULL`),
    query(`SELECT COUNT(*) AS total,
                  SUM(CASE WHEN publish_status = 'published' THEN 1 ELSE 0 END) AS published
           FROM chapters WHERE deleted_at IS NULL`),
    query(`SELECT COUNT(*) AS total,
                  SUM(CASE WHEN guild_status = 'active' THEN 1 ELSE 0 END) AS active
           FROM guilds`),
    query(`SELECT COUNT(*) AS total,
                  SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active
           FROM items`),
    query(`SELECT COUNT(*) AS total,
                  SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active
           FROM chat_rooms`),
    query(`SELECT COUNT(*) AS total,
                  SUM(CASE WHEN notification_status = 'sent' THEN 1 ELSE 0 END) AS sent,
                  SUM(CASE WHEN notification_status = 'draft' THEN 1 ELSE 0 END) AS draft
           FROM system_notifications`),
    query(`SELECT COUNT(*) AS total,
                  SUM(CASE WHEN comment_status = 'visible' THEN 1 ELSE 0 END) AS visible,
                  SUM(CASE WHEN report_count > 0 THEN 1 ELSE 0 END) AS reported
           FROM comments`),
    query(`SELECT COUNT(*) AS total FROM vip_levels`),
    query(`SELECT COUNT(*) AS total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active FROM missions`),
    query(`SELECT COUNT(*) AS running FROM afk_sessions WHERE session_status = 'running'`),
  ]);

  const recentComics = await query(
    `SELECT c.id, c.title, c.publication_status, c.total_views, c.created_at,
            a.name AS author_name,
            COUNT(DISTINCT ch.id) AS total_chapters,
            GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR ', ') AS genres
     FROM comics c
     LEFT JOIN authors a ON a.id = c.author_id
     LEFT JOIN chapters ch ON ch.comic_id = c.id AND ch.deleted_at IS NULL
     LEFT JOIN comic_genres cg ON cg.comic_id = c.id
     LEFT JOIN genres g ON g.id = cg.genre_id
     WHERE c.deleted_at IS NULL
     GROUP BY c.id, a.name
     ORDER BY c.id DESC
     LIMIT 6`
  );

  const recentActivities = await query(
    `SELECT 'comic' AS source_type, c.id AS source_id, c.title AS source_name, c.created_at AS action_at, 'Tạo truyện mới' AS action_label
     FROM comics c WHERE c.deleted_at IS NULL
     UNION ALL
     SELECT 'guild', g.id, g.name, g.created_at, 'Bang hội được tạo'
     FROM guilds g
     UNION ALL
     SELECT 'notification', sn.id, sn.title, sn.created_at, 'Tạo thông báo hệ thống'
     FROM system_notifications sn
     ORDER BY action_at DESC
     LIMIT 10`
  );

  const latestPowerRanking = await getRankingList('power', { limit: 5, fromLive: true });

  return {
    summary: {
      users: users[0],
      comics: comics[0],
      chapters: chapters[0],
      guilds: guilds[0],
      items: items[0],
      rooms: rooms[0],
      notifications: notifications[0],
      comments: comments[0],
      vipLevels: vipLevels[0],
      missions: missions[0],
      afkRunning: afkRunning[0],
    },
    recentComics,
    recentActivities,
    latestPowerRanking,
  };
}

async function listGenres(filters = {}) {
  const q = filters.q ? `%${String(filters.q).trim()}%` : null;
  const items = await query(
    `SELECT g.*, COUNT(DISTINCT cg.comic_id) AS comics_count
     FROM genres g
     LEFT JOIN comic_genres cg ON cg.genre_id = g.id
     WHERE (:q IS NULL OR CONCAT(IFNULL(g.name,''), ' ', IFNULL(g.slug,''), ' ', IFNULL(g.description,'')) LIKE :q)
     GROUP BY g.id
     ORDER BY g.name ASC`,
    { q }
  );

  const totalComics = items.reduce((sum, item) => sum + Number(item.comics_count || 0), 0);
  return {
    stats: {
      total: items.length,
      totalComics,
      averageComics: items.length ? Math.round(totalComics / items.length) : 0,
    },
    items,
  };
}

async function createGenre(payload = {}) {
  if (!payload.name || !payload.slug) throw new ApiError(400, 'name và slug là bắt buộc');
  const existing = await query(`SELECT id FROM genres WHERE name = :name OR slug = :slug LIMIT 1`, { name: payload.name, slug: payload.slug });
  if (existing.length) throw new ApiError(400, 'Tên hoặc slug thể loại đã tồn tại');
  await query(
    `INSERT INTO genres (name, slug, description, created_at, updated_at)
     VALUES (:name, :slug, :description, NOW(), NOW())`,
    { name: payload.name, slug: payload.slug, description: payload.description || null }
  );
  return listGenres();
}

async function updateGenre(id, payload = {}) {
  const rows = await query(`SELECT * FROM genres WHERE id = :id LIMIT 1`, { id });
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy thể loại');
  const current = rows[0];
  const name = payload.name ?? current.name;
  const slug = payload.slug ?? current.slug;
  const duplicate = await query(`SELECT id FROM genres WHERE (name = :name OR slug = :slug) AND id <> :id LIMIT 1`, { id, name, slug });
  if (duplicate.length) throw new ApiError(400, 'Tên hoặc slug thể loại đã tồn tại');
  await query(
    `UPDATE genres SET name = :name, slug = :slug, description = :description, updated_at = NOW() WHERE id = :id`,
    { id, name, slug, description: payload.description ?? current.description }
  );
  return (await query(`SELECT * FROM genres WHERE id = :id LIMIT 1`, { id }))[0];
}

async function deleteGenre(id) {
  return transaction(async (conn) => {
    await conn.query(`DELETE FROM comic_genres WHERE genre_id = :id`, { id });
    await conn.query(`DELETE FROM genres WHERE id = :id`, { id });
    return { id: Number(id), deleted: true };
  });
}

async function listComments(filters = {}) {
  const q = filters.q ? `%${String(filters.q).trim()}%` : null;
  const status = filters.status || null;
  const comicId = toNullableInt(filters.comicId);

  const items = await query(
    `SELECT c.id, c.user_id, c.comic_id, c.chapter_id, c.parent_comment_id, c.content, c.comment_status,
            c.like_count, c.report_count, c.created_at, c.updated_at,
            u.display_name AS user_name, u.username, u.avatar_url,
            co.title AS comic_title,
            ch.title AS chapter_title, ch.chapter_number
     FROM comments c
     INNER JOIN users u ON u.id = c.user_id
     LEFT JOIN comics co ON co.id = c.comic_id
     LEFT JOIN chapters ch ON ch.id = c.chapter_id
     WHERE (:q IS NULL OR CONCAT(IFNULL(u.display_name,''), ' ', IFNULL(u.username,''), ' ', IFNULL(co.title,''), ' ', IFNULL(c.content,'')) LIKE :q)
       AND (:status IS NULL OR c.comment_status = :status)
       AND (:comicId IS NULL OR c.comic_id = :comicId)
     ORDER BY c.created_at DESC`,
    { q, status, comicId }
  );

  const comics = await query(`SELECT id, title FROM comics WHERE deleted_at IS NULL ORDER BY title ASC`);

  return {
    stats: {
      total: items.length,
      visible: items.filter((item) => item.comment_status === 'visible').length,
      hidden: items.filter((item) => item.comment_status === 'hidden').length,
      reported: items.filter((item) => Number(item.report_count || 0) > 0).length,
    },
    comics,
    items,
  };
}

async function updateCommentStatus(id, comment_status) {
  if (!['visible', 'hidden', 'deleted'].includes(comment_status)) {
    throw new ApiError(400, 'Trạng thái bình luận không hợp lệ');
  }
  await query(`UPDATE comments SET comment_status = :comment_status, updated_at = NOW() WHERE id = :id`, { id, comment_status });
  return (await query(`SELECT * FROM comments WHERE id = :id LIMIT 1`, { id }))[0];
}

async function deleteComment(id) {
  await query(`DELETE FROM comments WHERE id = :id`, { id });
  return { id: Number(id), deleted: true };
}

async function listUsersAdmin(filters = {}) {
  const q = filters.q ? `%${String(filters.q).trim()}%` : null;
  const status = filters.status || null;
  const vipFilter = filters.vipFilter || null;

  const items = await query(
    `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.account_status, u.is_email_verified, u.created_at,
            r.code AS role_code, r.name AS role_name,
            up.gold_balance, up.premium_currency, up.power_score,
            uc.current_exp, uc.total_exp_earned, uc.combat_power,
            lv.level_number AS level_number,
            re.name AS realm_name,
            g.name AS guild_name,
            vl.level_number AS vip_level_number,
            vl.name AS vip_level_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN user_cultivation uc ON uc.user_id = u.id
     LEFT JOIN levels lv ON lv.id = uc.current_level_id
     LEFT JOIN realms re ON re.id = uc.current_realm_id
     LEFT JOIN guilds g ON g.id = u.current_guild_id
     LEFT JOIN user_vip uv ON uv.user_id = u.id
     LEFT JOIN vip_levels vl ON vl.id = uv.current_vip_level_id
     WHERE u.deleted_at IS NULL
       AND (:q IS NULL OR CONCAT(IFNULL(u.display_name,''), ' ', IFNULL(u.username,''), ' ', IFNULL(u.email,'')) LIKE :q)
       AND (:status IS NULL OR u.account_status = :status)
       AND (:vipFilter IS NULL OR (CASE WHEN vl.level_number IS NULL OR vl.level_number = 0 THEN 'normal' ELSE 'vip' END) = :vipFilter)
     ORDER BY u.id DESC`,
    { q, status, vipFilter }
  );

  const [roles, levels, realms, vipLevels] = await Promise.all([
    query(`SELECT id, code, name FROM roles ORDER BY id ASC`),
    query(`SELECT id, level_number FROM levels ORDER BY level_number ASC`),
    query(`SELECT id, name, realm_order FROM realms ORDER BY realm_order ASC`),
    query(`SELECT id, level_number, name FROM vip_levels ORDER BY level_number ASC`),
  ]);

  const stats = {
    total: items.length,
    active: items.filter((item) => item.account_status === 'active').length,
    blocked: items.filter((item) => ['banned', 'suspended'].includes(item.account_status)).length,
    vip: items.filter((item) => Number(item.vip_level_number || 0) > 0).length,
  };

  return { stats, items, roles, levels, realms, vipLevels };
}

async function getUserAdminDetail(id) {
  const rows = await query(
    `SELECT u.id, u.role_id, u.username, u.email, u.display_name, u.avatar_url, u.account_status, u.is_email_verified,
            up.full_name, up.phone_number, up.country, up.bio, up.gold_balance, up.premium_currency, up.power_score,
            uc.current_level_id, uc.current_realm_id, uc.current_exp, uc.total_exp_earned, uc.combat_power,
            uv.current_vip_level_id, uv.total_topup_amount, uv.vip_exp
     FROM users u
     LEFT JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN user_cultivation uc ON uc.user_id = u.id
     LEFT JOIN user_vip uv ON uv.user_id = u.id
     WHERE u.id = :id AND u.deleted_at IS NULL
     LIMIT 1`,
    { id }
  );
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy người dùng');
  return rows[0];
}

async function createUserAdmin(payload = {}) {
  if (!payload.username || !payload.email || !payload.password) {
    throw new ApiError(400, 'username, email và password là bắt buộc');
  }

  return transaction(async (conn) => {
    const existing = await queryWithConn(
      conn,
      `SELECT id FROM users WHERE (username = :username OR email = :email) AND deleted_at IS NULL LIMIT 1`,
      { username: payload.username, email: payload.email }
    );
    if (existing.length) throw new ApiError(400, 'Username hoặc email đã tồn tại');

    const roleId = payload.role_id ? Number(payload.role_id) : await findRoleIdByCode(payload.role_code || 'user', conn);
    const currentLevelId = payload.current_level_id ? Number(payload.current_level_id) : (await getFirstId('levels', 'level_number', conn));
    const currentRealmId = payload.current_realm_id ? Number(payload.current_realm_id) : (await getFirstId('realms', 'realm_order', conn));
    const currentVipLevelId = payload.current_vip_level_id ? Number(payload.current_vip_level_id) : (await getFirstId('vip_levels', 'level_number', conn));
    const passwordHash = await hashPassword(payload.password);

    const [userResult] = await conn.query(
      `INSERT INTO users (
        role_id, username, email, password_hash, display_name, avatar_url, account_status,
        is_verified, is_email_verified, current_guild_id, created_at, updated_at
      ) VALUES (
        :role_id, :username, :email, :password_hash, :display_name, :avatar_url, :account_status,
        1, :is_email_verified, NULL, NOW(), NOW()
      )`,
      {
        role_id: roleId,
        username: payload.username,
        email: payload.email,
        password_hash: passwordHash,
        display_name: payload.display_name || payload.username,
        avatar_url: payload.avatar_url || null,
        account_status: payload.account_status || 'active',
        is_email_verified: normalizeBool(payload.is_email_verified) ? 1 : 0,
      }
    );

    const userId = userResult.insertId;

    await conn.query(
      `INSERT INTO user_profiles (
        user_id, full_name, phone_number, country, bio, gold_balance, premium_currency, energy, stamina, power_score, created_at, updated_at
      ) VALUES (
        :user_id, :full_name, :phone_number, :country, :bio, :gold_balance, :premium_currency, 100, 100, :power_score, NOW(), NOW()
      )`,
      {
        user_id: userId,
        full_name: payload.full_name || payload.display_name || payload.username,
        phone_number: payload.phone_number || null,
        country: payload.country || null,
        bio: payload.bio || null,
        gold_balance: Number(payload.gold_balance || 0),
        premium_currency: Number(payload.premium_currency || 0),
        power_score: Number(payload.power_score || 0),
      }
    );

    if (currentLevelId && currentRealmId) {
      await conn.query(
        `INSERT INTO user_cultivation (
          user_id, current_level_id, current_realm_id, current_exp, total_exp_earned, combat_power, created_at, updated_at
        ) VALUES (
          :user_id, :current_level_id, :current_realm_id, :current_exp, :total_exp_earned, :combat_power, NOW(), NOW()
        )`,
        {
          user_id: userId,
          current_level_id: currentLevelId,
          current_realm_id: currentRealmId,
          current_exp: Number(payload.current_exp || 0),
          total_exp_earned: Number(payload.total_exp_earned || 0),
          combat_power: Number(payload.combat_power || 0),
        }
      );
    }

    if (currentVipLevelId) {
      await conn.query(
        `INSERT INTO user_vip (
          user_id, current_vip_level_id, total_topup_amount, vip_exp, created_at, updated_at
        ) VALUES (
          :user_id, :current_vip_level_id, :total_topup_amount, :vip_exp, NOW(), NOW()
        )`,
        {
          user_id: userId,
          current_vip_level_id: currentVipLevelId,
          total_topup_amount: Number(payload.total_topup_amount || 0),
          vip_exp: Number(payload.vip_exp || 0),
        }
      );
    }

    return getUserAdminDetail(userId);
  });
}

async function updateUserAdmin(id, payload = {}) {
  return transaction(async (conn) => {
    const users = await queryWithConn(conn, `SELECT * FROM users WHERE id = :id AND deleted_at IS NULL LIMIT 1`, { id });
    if (!users.length) throw new ApiError(404, 'Không tìm thấy người dùng');
    const current = users[0];

    const roleId = payload.role_id ? Number(payload.role_id) : (payload.role_code ? await findRoleIdByCode(payload.role_code, conn) : current.role_id);

    await conn.query(
      `UPDATE users
       SET role_id = :role_id,
           username = :username,
           email = :email,
           display_name = :display_name,
           avatar_url = :avatar_url,
           account_status = :account_status,
           is_email_verified = :is_email_verified,
           updated_at = NOW()
       WHERE id = :id`,
      {
        id,
        role_id: roleId,
        username: payload.username ?? current.username,
        email: payload.email ?? current.email,
        display_name: payload.display_name ?? current.display_name,
        avatar_url: payload.avatar_url ?? current.avatar_url,
        account_status: payload.account_status ?? current.account_status,
        is_email_verified: payload.is_email_verified === undefined ? current.is_email_verified : (normalizeBool(payload.is_email_verified) ? 1 : 0),
      }
    );

    const profileRows = await queryWithConn(conn, `SELECT * FROM user_profiles WHERE user_id = :id LIMIT 1`, { id });
    if (profileRows.length) {
      const profile = profileRows[0];
      await conn.query(
        `UPDATE user_profiles
         SET full_name = :full_name,
             phone_number = :phone_number,
             country = :country,
             bio = :bio,
             gold_balance = :gold_balance,
             premium_currency = :premium_currency,
             power_score = :power_score,
             updated_at = NOW()
         WHERE user_id = :id`,
        {
          id,
          full_name: payload.full_name ?? profile.full_name,
          phone_number: payload.phone_number ?? profile.phone_number,
          country: payload.country ?? profile.country,
          bio: payload.bio ?? profile.bio,
          gold_balance: payload.gold_balance ?? profile.gold_balance,
          premium_currency: payload.premium_currency ?? profile.premium_currency,
          power_score: payload.power_score ?? profile.power_score,
        }
      );
    }

    const cultRows = await queryWithConn(conn, `SELECT * FROM user_cultivation WHERE user_id = :id LIMIT 1`, { id });
    if (cultRows.length) {
      const cult = cultRows[0];
      await conn.query(
        `UPDATE user_cultivation
         SET current_level_id = :current_level_id,
             current_realm_id = :current_realm_id,
             current_exp = :current_exp,
             total_exp_earned = :total_exp_earned,
             combat_power = :combat_power,
             updated_at = NOW()
         WHERE user_id = :id`,
        {
          id,
          current_level_id: payload.current_level_id ?? cult.current_level_id,
          current_realm_id: payload.current_realm_id ?? cult.current_realm_id,
          current_exp: payload.current_exp ?? cult.current_exp,
          total_exp_earned: payload.total_exp_earned ?? cult.total_exp_earned,
          combat_power: payload.combat_power ?? cult.combat_power,
        }
      );
    }

    const vipRows = await queryWithConn(conn, `SELECT * FROM user_vip WHERE user_id = :id LIMIT 1`, { id });
    if (vipRows.length) {
      const vip = vipRows[0];
      await conn.query(
        `UPDATE user_vip
         SET current_vip_level_id = :current_vip_level_id,
             total_topup_amount = :total_topup_amount,
             vip_exp = :vip_exp,
             updated_at = NOW()
         WHERE user_id = :id`,
        {
          id,
          current_vip_level_id: payload.current_vip_level_id ?? vip.current_vip_level_id,
          total_topup_amount: payload.total_topup_amount ?? vip.total_topup_amount,
          vip_exp: payload.vip_exp ?? vip.vip_exp,
        }
      );
    }

    return getUserAdminDetail(id);
  });
}

async function deleteUserAdmin(id) {
  await query(`UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id`, { id });
  return { id: Number(id), deleted: true };
}

async function listGuildsAdmin(filters = {}) {
  const q = filters.q ? `%${String(filters.q).trim()}%` : null;
  const items = await query(
    `SELECT g.*, u.display_name AS leader_name,
            COUNT(DISTINCT gm.id) AS members_count,
            SUM(CASE WHEN gjr.request_status = 'pending' THEN 1 ELSE 0 END) AS pending_requests
     FROM guilds g
     LEFT JOIN users u ON u.id = g.leader_user_id
     LEFT JOIN guild_members gm ON gm.guild_id = g.id AND gm.join_status = 'active'
     LEFT JOIN guild_join_requests gjr ON gjr.guild_id = g.id
     WHERE (:q IS NULL OR CONCAT(IFNULL(g.name,''), ' ', IFNULL(g.slug,''), ' ', IFNULL(g.description,'')) LIKE :q)
     GROUP BY g.id, u.display_name
     ORDER BY g.id DESC`,
    { q }
  );
  const [members, requests, roles, logs, users] = await Promise.all([
    query(`SELECT gm.id, gm.guild_id, gm.user_id, gm.guild_role_id, gm.join_status, gm.contribution_points, gm.joined_at,
                  g.name AS guild_name, u.display_name AS user_name, gr.name AS role_name
           FROM guild_members gm
           INNER JOIN guilds g ON g.id = gm.guild_id
           INNER JOIN users u ON u.id = gm.user_id
           INNER JOIN guild_roles gr ON gr.id = gm.guild_role_id
           ORDER BY gm.joined_at DESC`),
    query(`SELECT gjr.id, gjr.guild_id, gjr.user_id, gjr.request_message, gjr.request_status, gjr.reviewed_at, gjr.created_at,
                  g.name AS guild_name, u.display_name AS user_name
           FROM guild_join_requests gjr
           INNER JOIN guilds g ON g.id = gjr.guild_id
           INNER JOIN users u ON u.id = gjr.user_id
           ORDER BY gjr.created_at DESC`),
    query(`SELECT * FROM guild_roles ORDER BY hierarchy_level ASC, id ASC`),
    query(`SELECT gl.*, g.name AS guild_name, u.display_name AS user_name, target.display_name AS target_user_name
           FROM guild_logs gl
           LEFT JOIN guilds g ON g.id = gl.guild_id
           LEFT JOIN users u ON u.id = gl.user_id
           LEFT JOIN users target ON target.id = gl.target_user_id
           ORDER BY gl.created_at DESC
           LIMIT 200`),
    query(`SELECT id, display_name FROM users WHERE deleted_at IS NULL ORDER BY display_name ASC`),
  ]);

  return {
    stats: {
      total: items.length,
      active: items.filter((item) => item.guild_status === 'active').length,
      members: items.reduce((sum, item) => sum + Number(item.members_count || 0), 0),
      pending: requests.filter((item) => item.request_status === 'pending').length,
    },
    items,
    members,
    requests,
    roles,
    logs,
    users,
  };
}

async function createGuildAdmin(actorUserId, payload = {}) {
  if (!payload.name || !payload.slug || !payload.leader_user_id) {
    throw new ApiError(400, 'name, slug và leader_user_id là bắt buộc');
  }
  return transaction(async (conn) => {
    const duplicate = await queryWithConn(conn, `SELECT id FROM guilds WHERE name = :name OR slug = :slug LIMIT 1`, { name: payload.name, slug: payload.slug });
    if (duplicate.length) throw new ApiError(400, 'Tên hoặc slug bang phái đã tồn tại');

    const [result] = await conn.query(
      `INSERT INTO guilds (
        name, slug, logo_url, description, announcement, leader_user_id, member_limit, level,
        contribution_points, guild_power, guild_status, created_at, updated_at
      ) VALUES (
        :name, :slug, :logo_url, :description, :announcement, :leader_user_id, :member_limit, :level,
        :contribution_points, :guild_power, :guild_status, NOW(), NOW()
      )`,
      {
        name: payload.name,
        slug: payload.slug,
        logo_url: payload.logo_url || null,
        description: payload.description || null,
        announcement: payload.announcement || null,
        leader_user_id: Number(payload.leader_user_id),
        member_limit: Number(payload.member_limit || 30),
        level: Number(payload.level || 1),
        contribution_points: Number(payload.contribution_points || 0),
        guild_power: Number(payload.guild_power || 0),
        guild_status: payload.guild_status || 'active',
      }
    );

    const guildId = result.insertId;
    const leaderRoleId = payload.guild_role_id || (await getFirstId('guild_roles', 'hierarchy_level', conn));
    if (leaderRoleId) {
      const existingMember = await queryWithConn(conn, `SELECT id FROM guild_members WHERE guild_id = :guildId AND user_id = :userId LIMIT 1`, { guildId, userId: payload.leader_user_id });
      if (!existingMember.length) {
        await conn.query(
          `INSERT INTO guild_members (guild_id, user_id, guild_role_id, join_status, contribution_points, joined_at)
           VALUES (:guildId, :userId, :roleId, 'active', 0, NOW())`,
          { guildId, userId: payload.leader_user_id, roleId: leaderRoleId }
        );
      }
      await conn.query(`UPDATE users SET current_guild_id = :guildId, updated_at = NOW() WHERE id = :userId`, { guildId, userId: payload.leader_user_id });
    }
    await conn.query(
      `INSERT INTO guild_logs (guild_id, user_id, action_type, details, created_at)
       VALUES (:guildId, :actorUserId, 'create', 'Tạo bang hội từ admin', NOW())`,
      { guildId, actorUserId: actorUserId || payload.leader_user_id }
    );
    return (await query(`SELECT * FROM guilds WHERE id = :id LIMIT 1`, { id: guildId }))[0];
  });
}

async function updateGuildAdmin(id, payload = {}) {
  const rows = await query(`SELECT * FROM guilds WHERE id = :id LIMIT 1`, { id });
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy bang phái');
  const current = rows[0];
  const next = {
    name: payload.name ?? current.name,
    slug: payload.slug ?? current.slug,
    logo_url: payload.logo_url ?? current.logo_url,
    description: payload.description ?? current.description,
    announcement: payload.announcement ?? current.announcement,
    leader_user_id: payload.leader_user_id ?? current.leader_user_id,
    member_limit: payload.member_limit ?? current.member_limit,
    level: payload.level ?? current.level,
    contribution_points: payload.contribution_points ?? current.contribution_points,
    guild_power: payload.guild_power ?? current.guild_power,
    guild_status: payload.guild_status ?? current.guild_status,
  };
  await query(
    `UPDATE guilds
     SET name = :name, slug = :slug, logo_url = :logo_url, description = :description, announcement = :announcement,
         leader_user_id = :leader_user_id, member_limit = :member_limit, level = :level,
         contribution_points = :contribution_points, guild_power = :guild_power, guild_status = :guild_status,
         updated_at = NOW()
     WHERE id = :id`,
    { id, ...next }
  );
  return (await query(`SELECT * FROM guilds WHERE id = :id LIMIT 1`, { id }))[0];
}

async function deleteGuildAdmin(id) {
  await query(`UPDATE guilds SET guild_status = 'disbanded', updated_at = NOW() WHERE id = :id`, { id });
  return { id: Number(id), deleted: true };
}

async function createGuildRoleAdmin(payload = {}) {
  if (!payload.code || !payload.name) throw new ApiError(400, 'code và name là bắt buộc');
  await query(
    `INSERT INTO guild_roles (
      code, name, hierarchy_level, can_manage_members, can_approve_join, can_post_notice,
      can_manage_chat, can_promote_members, can_manage_guild, description, created_at, updated_at
    ) VALUES (
      :code, :name, :hierarchy_level, :can_manage_members, :can_approve_join, :can_post_notice,
      :can_manage_chat, :can_promote_members, :can_manage_guild, :description, NOW(), NOW()
    )`,
    {
      code: payload.code,
      name: payload.name,
      hierarchy_level: Number(payload.hierarchy_level || 1),
      can_manage_members: normalizeBool(payload.can_manage_members) ? 1 : 0,
      can_approve_join: normalizeBool(payload.can_approve_join) ? 1 : 0,
      can_post_notice: normalizeBool(payload.can_post_notice) ? 1 : 0,
      can_manage_chat: normalizeBool(payload.can_manage_chat) ? 1 : 0,
      can_promote_members: normalizeBool(payload.can_promote_members) ? 1 : 0,
      can_manage_guild: normalizeBool(payload.can_manage_guild) ? 1 : 0,
      description: payload.description || null,
    }
  );
  return { success: true };
}

async function updateGuildRoleAdmin(id, payload = {}) {
  const rows = await query(`SELECT * FROM guild_roles WHERE id = :id LIMIT 1`, { id });
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy chức vụ bang');
  const current = rows[0];
  await query(
    `UPDATE guild_roles
     SET code = :code, name = :name, hierarchy_level = :hierarchy_level,
         can_manage_members = :can_manage_members, can_approve_join = :can_approve_join,
         can_post_notice = :can_post_notice, can_manage_chat = :can_manage_chat,
         can_promote_members = :can_promote_members, can_manage_guild = :can_manage_guild,
         description = :description, updated_at = NOW()
     WHERE id = :id`,
    {
      id,
      code: payload.code ?? current.code,
      name: payload.name ?? current.name,
      hierarchy_level: payload.hierarchy_level ?? current.hierarchy_level,
      can_manage_members: payload.can_manage_members === undefined ? current.can_manage_members : (normalizeBool(payload.can_manage_members) ? 1 : 0),
      can_approve_join: payload.can_approve_join === undefined ? current.can_approve_join : (normalizeBool(payload.can_approve_join) ? 1 : 0),
      can_post_notice: payload.can_post_notice === undefined ? current.can_post_notice : (normalizeBool(payload.can_post_notice) ? 1 : 0),
      can_manage_chat: payload.can_manage_chat === undefined ? current.can_manage_chat : (normalizeBool(payload.can_manage_chat) ? 1 : 0),
      can_promote_members: payload.can_promote_members === undefined ? current.can_promote_members : (normalizeBool(payload.can_promote_members) ? 1 : 0),
      can_manage_guild: payload.can_manage_guild === undefined ? current.can_manage_guild : (normalizeBool(payload.can_manage_guild) ? 1 : 0),
      description: payload.description ?? current.description,
    }
  );
  return { success: true };
}

async function deleteGuildRoleAdmin(id) {
  await query(`DELETE FROM guild_roles WHERE id = :id`, { id });
  return { id: Number(id), deleted: true };
}

async function reviewGuildJoinRequestAdmin(requestId, actorUserId, action) {
  if (!['approved', 'rejected'].includes(action)) throw new ApiError(400, 'Action không hợp lệ');
  return transaction(async (conn) => {
    const rows = await queryWithConn(conn,
      `SELECT * FROM guild_join_requests WHERE id = :requestId LIMIT 1`,
      { requestId }
    );
    if (!rows.length) throw new ApiError(404, 'Không tìm thấy yêu cầu gia nhập');
    const request = rows[0];

    await conn.query(
      `UPDATE guild_join_requests
       SET request_status = :action, reviewed_by_user_id = :actorUserId, reviewed_at = NOW()
       WHERE id = :requestId`,
      { requestId, actorUserId, action }
    );

    if (action === 'approved') {
      const roleId = await getFirstId('guild_roles', 'hierarchy_level', conn);
      const exists = await queryWithConn(conn,
        `SELECT id FROM guild_members WHERE guild_id = :guild_id AND user_id = :user_id AND join_status = 'active' LIMIT 1`,
        { guild_id: request.guild_id, user_id: request.user_id }
      );
      if (!exists.length && roleId) {
        await conn.query(
          `INSERT INTO guild_members (guild_id, user_id, guild_role_id, join_status, contribution_points, joined_at)
           VALUES (:guild_id, :user_id, :guild_role_id, 'active', 0, NOW())`,
          { guild_id: request.guild_id, user_id: request.user_id, guild_role_id: roleId }
        );
      }
      await conn.query(`UPDATE users SET current_guild_id = :guild_id, updated_at = NOW() WHERE id = :user_id`, { guild_id: request.guild_id, user_id: request.user_id });
      await conn.query(
        `INSERT INTO guild_logs (guild_id, user_id, action_type, target_user_id, details, created_at)
         VALUES (:guild_id, :actorUserId, 'approve_join', :target_user_id, 'Duyệt yêu cầu gia nhập từ admin', NOW())`,
        { guild_id: request.guild_id, actorUserId, target_user_id: request.user_id }
      );
    } else {
      await conn.query(
        `INSERT INTO guild_logs (guild_id, user_id, action_type, target_user_id, details, created_at)
         VALUES (:guild_id, :actorUserId, 'reject_join', :target_user_id, 'Từ chối yêu cầu gia nhập từ admin', NOW())`,
        { guild_id: request.guild_id, actorUserId, target_user_id: request.user_id }
      );
    }

    return { id: Number(requestId), request_status: action };
  });
}

async function listCultivationAdmin() {
  const [realms, levels, snapshots] = await Promise.all([
    query(`SELECT * FROM realms ORDER BY realm_order ASC`),
    query(`SELECT * FROM levels ORDER BY level_number ASC`),
    query(`SELECT snapshot_date, ranking_type, COUNT(*) AS total_rows FROM ranking_snapshots GROUP BY snapshot_date, ranking_type ORDER BY snapshot_date DESC LIMIT 20`),
  ]);
  return {
    overview: {
      totalRealms: realms.length,
      totalLevels: levels.length,
    },
    realms,
    levels,
    snapshots,
  };
}

async function createRealm(payload = {}) {
  if (!payload.name) throw new ApiError(400, 'name là bắt buộc');
  await query(
    `INSERT INTO realms (name, realm_order, description, base_power_bonus, created_at, updated_at)
     VALUES (:name, :realm_order, :description, :base_power_bonus, NOW(), NOW())`,
    {
      name: payload.name,
      realm_order: Number(payload.realm_order || 1),
      description: payload.description || null,
      base_power_bonus: Number(payload.base_power_bonus || 0),
    }
  );
  return { success: true };
}

async function updateRealm(id, payload = {}) {
  const rows = await query(`SELECT * FROM realms WHERE id = :id LIMIT 1`, { id });
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy cảnh giới');
  const current = rows[0];
  await query(
    `UPDATE realms SET name = :name, realm_order = :realm_order, description = :description, base_power_bonus = :base_power_bonus, updated_at = NOW() WHERE id = :id`,
    {
      id,
      name: payload.name ?? current.name,
      realm_order: payload.realm_order ?? current.realm_order,
      description: payload.description ?? current.description,
      base_power_bonus: payload.base_power_bonus ?? current.base_power_bonus,
    }
  );
  return { success: true };
}

async function deleteRealm(id) {
  await query(`DELETE FROM realms WHERE id = :id`, { id });
  return { id: Number(id), deleted: true };
}

async function createLevel(payload = {}) {
  if (payload.level_number === undefined || payload.exp_required === undefined) throw new ApiError(400, 'level_number và exp_required là bắt buộc');
  await query(
    `INSERT INTO levels (level_number, exp_required, reward_gold, reward_premium, created_at, updated_at)
     VALUES (:level_number, :exp_required, :reward_gold, :reward_premium, NOW(), NOW())`,
    {
      level_number: Number(payload.level_number),
      exp_required: Number(payload.exp_required),
      reward_gold: Number(payload.reward_gold || 0),
      reward_premium: Number(payload.reward_premium || 0),
    }
  );
  return { success: true };
}

async function updateLevel(id, payload = {}) {
  const rows = await query(`SELECT * FROM levels WHERE id = :id LIMIT 1`, { id });
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy level');
  const current = rows[0];
  await query(
    `UPDATE levels SET level_number = :level_number, exp_required = :exp_required, reward_gold = :reward_gold, reward_premium = :reward_premium, updated_at = NOW() WHERE id = :id`,
    {
      id,
      level_number: payload.level_number ?? current.level_number,
      exp_required: payload.exp_required ?? current.exp_required,
      reward_gold: payload.reward_gold ?? current.reward_gold,
      reward_premium: payload.reward_premium ?? current.reward_premium,
    }
  );
  return { success: true };
}

async function deleteLevel(id) {
  await query(`DELETE FROM levels WHERE id = :id`, { id });
  return { id: Number(id), deleted: true };
}

async function listMissionsAdmin(filters = {}) {
  const missionType = filters.missionType || null;
  const status = filters.status || null;
  const q = filters.q ? `%${String(filters.q).trim()}%` : null;
  const items = await query(
    `SELECT m.*, i.name AS reward_item_name
     FROM missions m
     LEFT JOIN items i ON i.id = m.reward_item_id
     WHERE (:missionType IS NULL OR m.mission_type = :missionType)
       AND (:status IS NULL OR (CASE WHEN m.is_active = 1 THEN 'active' ELSE 'inactive' END) = :status)
       AND (:q IS NULL OR CONCAT(IFNULL(m.title,''), ' ', IFNULL(m.code,''), ' ', IFNULL(m.description,'')) LIKE :q)
     ORDER BY m.id DESC`,
    { missionType, status, q }
  );
  const itemsOptions = await query(`SELECT id, name FROM items WHERE is_active = 1 ORDER BY name ASC`);
  return {
    stats: {
      total: items.length,
      active: items.filter((item) => Number(item.is_active) === 1).length,
      paused: items.filter((item) => Number(item.is_active) !== 1).length,
      events: items.filter((item) => item.mission_type === 'event').length,
    },
    items,
    itemOptions: itemsOptions,
  };
}

async function createMission(payload = {}) {
  if (!payload.code || !payload.title || !payload.target_type) throw new ApiError(400, 'code, title, target_type là bắt buộc');
  await query(
    `INSERT INTO missions (
      code, title, description, mission_type, target_type, target_value, reward_gold, reward_exp,
      reward_item_id, reward_item_qty, is_active, start_at, end_at, created_at, updated_at
    ) VALUES (
      :code, :title, :description, :mission_type, :target_type, :target_value, :reward_gold, :reward_exp,
      :reward_item_id, :reward_item_qty, :is_active, :start_at, :end_at, NOW(), NOW()
    )`,
    {
      code: payload.code,
      title: payload.title,
      description: payload.description || null,
      mission_type: payload.mission_type || 'daily',
      target_type: payload.target_type,
      target_value: Number(payload.target_value || 1),
      reward_gold: Number(payload.reward_gold || 0),
      reward_exp: Number(payload.reward_exp || 0),
      reward_item_id: toNullableInt(payload.reward_item_id),
      reward_item_qty: Number(payload.reward_item_qty || 0),
      is_active: normalizeBool(payload.is_active ?? true) ? 1 : 0,
      start_at: payload.start_at || null,
      end_at: payload.end_at || null,
    }
  );
  return { success: true };
}

async function updateMission(id, payload = {}) {
  const rows = await query(`SELECT * FROM missions WHERE id = :id LIMIT 1`, { id });
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy nhiệm vụ');
  const current = rows[0];
  await query(
    `UPDATE missions
     SET code = :code, title = :title, description = :description, mission_type = :mission_type,
         target_type = :target_type, target_value = :target_value, reward_gold = :reward_gold, reward_exp = :reward_exp,
         reward_item_id = :reward_item_id, reward_item_qty = :reward_item_qty, is_active = :is_active,
         start_at = :start_at, end_at = :end_at, updated_at = NOW()
     WHERE id = :id`,
    {
      id,
      code: payload.code ?? current.code,
      title: payload.title ?? current.title,
      description: payload.description ?? current.description,
      mission_type: payload.mission_type ?? current.mission_type,
      target_type: payload.target_type ?? current.target_type,
      target_value: payload.target_value ?? current.target_value,
      reward_gold: payload.reward_gold ?? current.reward_gold,
      reward_exp: payload.reward_exp ?? current.reward_exp,
      reward_item_id: payload.reward_item_id === undefined ? current.reward_item_id : toNullableInt(payload.reward_item_id),
      reward_item_qty: payload.reward_item_qty ?? current.reward_item_qty,
      is_active: payload.is_active === undefined ? current.is_active : (normalizeBool(payload.is_active) ? 1 : 0),
      start_at: payload.start_at ?? current.start_at,
      end_at: payload.end_at ?? current.end_at,
    }
  );
  return { success: true };
}

async function deleteMission(id) {
  await query(`DELETE FROM missions WHERE id = :id`, { id });
  return { id: Number(id), deleted: true };
}

async function listAfkAdmin() {
  const [configs, sessions] = await Promise.all([
    query(`SELECT * FROM afk_configs ORDER BY id ASC`),
    query(`SELECT s.*, u.display_name AS user_name
           FROM afk_sessions s
           INNER JOIN users u ON u.id = s.user_id
           ORDER BY s.created_at DESC
           LIMIT 200`),
  ]);
  const overview = {
    totalConfigs: configs.length,
    runningSessions: sessions.filter((item) => item.session_status === 'running').length,
    totalHoursToday: sessions
      .filter((item) => String(item.created_at).slice(0, 10) === new Date().toISOString().slice(0, 10))
      .reduce((sum, item) => sum + Number(item.duration_seconds || 0), 0) / 3600,
    usersAfk: new Set(sessions.filter((item) => item.session_status === 'running').map((item) => item.user_id)).size,
  };
  return { overview, configs, sessions };
}

async function createAfkConfig(payload = {}) {
  if (!payload.config_key || payload.config_value === undefined) throw new ApiError(400, 'config_key và config_value là bắt buộc');
  await query(
    `INSERT INTO afk_configs (config_key, config_value, value_type, description, created_at, updated_at)
     VALUES (:config_key, :config_value, :value_type, :description, NOW(), NOW())`,
    {
      config_key: payload.config_key,
      config_value: String(payload.config_value),
      value_type: payload.value_type || 'string',
      description: payload.description || null,
    }
  );
  return { success: true };
}

async function updateAfkConfig(id, payload = {}) {
  const rows = await query(`SELECT * FROM afk_configs WHERE id = :id LIMIT 1`, { id });
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy cấu hình AFK');
  const current = rows[0];
  await query(
    `UPDATE afk_configs SET config_key = :config_key, config_value = :config_value, value_type = :value_type, description = :description, updated_at = NOW() WHERE id = :id`,
    {
      id,
      config_key: payload.config_key ?? current.config_key,
      config_value: payload.config_value === undefined ? current.config_value : String(payload.config_value),
      value_type: payload.value_type ?? current.value_type,
      description: payload.description ?? current.description,
    }
  );
  return { success: true };
}

async function deleteAfkConfig(id) {
  await query(`DELETE FROM afk_configs WHERE id = :id`, { id });
  return { id: Number(id), deleted: true };
}

async function listVipAdmin() {
  const [levels, benefits, users] = await Promise.all([
    query(`SELECT * FROM vip_levels ORDER BY level_number ASC`),
    query(`SELECT vb.*, vl.level_number, vl.name AS vip_level_name FROM vip_benefits vb INNER JOIN vip_levels vl ON vl.id = vb.vip_level_id ORDER BY vl.level_number ASC, vb.id ASC`),
    query(`SELECT uv.*, u.display_name, u.username, vl.level_number, vl.name AS vip_level_name
           FROM user_vip uv
           INNER JOIN users u ON u.id = uv.user_id
           LEFT JOIN vip_levels vl ON vl.id = uv.current_vip_level_id
           WHERE u.deleted_at IS NULL
           ORDER BY uv.total_topup_amount DESC, uv.vip_exp DESC`),
  ]);
  return {
    overview: {
      totalLevels: levels.length,
      totalBenefits: benefits.length,
      vipUsers: users.filter((item) => Number(item.level_number || 0) > 0).length,
      totalTopup: users.reduce((sum, item) => sum + Number(item.total_topup_amount || 0), 0),
    },
    levels,
    benefits,
    users,
  };
}

async function createVipLevel(payload = {}) {
  if (payload.level_number === undefined || !payload.name) throw new ApiError(400, 'level_number và name là bắt buộc');
  await query(
    `INSERT INTO vip_levels (level_number, name, required_topup_amount, badge_name, badge_color, description, created_at, updated_at)
     VALUES (:level_number, :name, :required_topup_amount, :badge_name, :badge_color, :description, NOW(), NOW())`,
    {
      level_number: Number(payload.level_number),
      name: payload.name,
      required_topup_amount: Number(payload.required_topup_amount || 0),
      badge_name: payload.badge_name || null,
      badge_color: payload.badge_color || null,
      description: payload.description || null,
    }
  );
  return { success: true };
}

async function updateVipLevel(id, payload = {}) {
  const rows = await query(`SELECT * FROM vip_levels WHERE id = :id LIMIT 1`, { id });
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy VIP level');
  const current = rows[0];
  await query(
    `UPDATE vip_levels
     SET level_number = :level_number, name = :name, required_topup_amount = :required_topup_amount,
         badge_name = :badge_name, badge_color = :badge_color, description = :description, updated_at = NOW()
     WHERE id = :id`,
    {
      id,
      level_number: payload.level_number ?? current.level_number,
      name: payload.name ?? current.name,
      required_topup_amount: payload.required_topup_amount ?? current.required_topup_amount,
      badge_name: payload.badge_name ?? current.badge_name,
      badge_color: payload.badge_color ?? current.badge_color,
      description: payload.description ?? current.description,
    }
  );
  return { success: true };
}

async function deleteVipLevel(id) {
  await query(`DELETE FROM vip_levels WHERE id = :id`, { id });
  return { id: Number(id), deleted: true };
}

async function createVipBenefit(payload = {}) {
  if (!payload.vip_level_id || !payload.benefit_code || !payload.benefit_name) throw new ApiError(400, 'vip_level_id, benefit_code và benefit_name là bắt buộc');
  await query(
    `INSERT INTO vip_benefits (vip_level_id, benefit_code, benefit_name, benefit_value, description, created_at)
     VALUES (:vip_level_id, :benefit_code, :benefit_name, :benefit_value, :description, NOW())`,
    {
      vip_level_id: Number(payload.vip_level_id),
      benefit_code: payload.benefit_code,
      benefit_name: payload.benefit_name,
      benefit_value: payload.benefit_value || null,
      description: payload.description || null,
    }
  );
  return { success: true };
}

async function updateVipBenefit(id, payload = {}) {
  const rows = await query(`SELECT * FROM vip_benefits WHERE id = :id LIMIT 1`, { id });
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy quyền lợi VIP');
  const current = rows[0];
  await query(
    `UPDATE vip_benefits
     SET vip_level_id = :vip_level_id, benefit_code = :benefit_code, benefit_name = :benefit_name,
         benefit_value = :benefit_value, description = :description
     WHERE id = :id`,
    {
      id,
      vip_level_id: payload.vip_level_id ?? current.vip_level_id,
      benefit_code: payload.benefit_code ?? current.benefit_code,
      benefit_name: payload.benefit_name ?? current.benefit_name,
      benefit_value: payload.benefit_value ?? current.benefit_value,
      description: payload.description ?? current.description,
    }
  );
  return { success: true };
}

async function deleteVipBenefit(id) {
  await query(`DELETE FROM vip_benefits WHERE id = :id`, { id });
  return { id: Number(id), deleted: true };
}

async function getRankingList(type, options = {}) {
  const limit = Number(options.limit || 50);
  if (!['power', 'level', 'vip', 'guild_power'].includes(type)) throw new ApiError(400, 'Loại ranking không hợp lệ');
  if (type === 'guild_power') {
    return query(
      `SELECT g.id AS entity_id, g.name, g.guild_power AS score_value,
              u.display_name AS leader_name,
              ROW_NUMBER() OVER (ORDER BY g.guild_power DESC, g.id ASC) AS rank_position
       FROM guilds g
       LEFT JOIN users u ON u.id = g.leader_user_id
       WHERE g.guild_status <> 'disbanded'
       ORDER BY g.guild_power DESC, g.id ASC
       LIMIT :limit`,
      { limit }
    );
  }
  if (type === 'power') {
    return query(
      `SELECT u.id AS entity_id, u.display_name AS name, uc.combat_power AS score_value,
              lv.level_number, re.name AS realm_name,
              ROW_NUMBER() OVER (ORDER BY uc.combat_power DESC, u.id ASC) AS rank_position
       FROM user_cultivation uc
       INNER JOIN users u ON u.id = uc.user_id AND u.deleted_at IS NULL
       LEFT JOIN levels lv ON lv.id = uc.current_level_id
       LEFT JOIN realms re ON re.id = uc.current_realm_id
       ORDER BY uc.combat_power DESC, u.id ASC
       LIMIT :limit`,
      { limit }
    );
  }
  if (type === 'level') {
    return query(
      `SELECT u.id AS entity_id, u.display_name AS name, lv.level_number AS score_value,
              uc.current_exp, re.name AS realm_name,
              ROW_NUMBER() OVER (ORDER BY lv.level_number DESC, uc.current_exp DESC, u.id ASC) AS rank_position
       FROM user_cultivation uc
       INNER JOIN users u ON u.id = uc.user_id AND u.deleted_at IS NULL
       LEFT JOIN levels lv ON lv.id = uc.current_level_id
       LEFT JOIN realms re ON re.id = uc.current_realm_id
       ORDER BY lv.level_number DESC, uc.current_exp DESC, u.id ASC
       LIMIT :limit`,
      { limit }
    );
  }
  return query(
    `SELECT u.id AS entity_id, u.display_name AS name, vl.level_number AS score_value,
            uv.vip_exp, uv.total_topup_amount,
            ROW_NUMBER() OVER (ORDER BY vl.level_number DESC, uv.vip_exp DESC, u.id ASC) AS rank_position
     FROM user_vip uv
     INNER JOIN users u ON u.id = uv.user_id AND u.deleted_at IS NULL
     LEFT JOIN vip_levels vl ON vl.id = uv.current_vip_level_id
     ORDER BY vl.level_number DESC, uv.vip_exp DESC, u.id ASC
     LIMIT :limit`,
    { limit }
  );
}

async function getRankingOverview() {
  const [types, latestSnapshots] = await Promise.all([
    Promise.all(['power', 'level', 'vip', 'guild_power'].map(async (type) => ({ type, count: (await getRankingList(type, { limit: 5 })).length }))),
    query(`SELECT snapshot_date, ranking_type, COUNT(*) AS total_rows
           FROM ranking_snapshots
           GROUP BY snapshot_date, ranking_type
           ORDER BY snapshot_date DESC, ranking_type ASC
           LIMIT 20`),
  ]);
  return { types, latestSnapshots };
}

async function createRankingSnapshot(type, actorUserId, options = {}) {
  const rows = await getRankingList(type, { limit: Number(options.limit || 100) });
  const snapshotDate = options.snapshot_date || new Date().toISOString().slice(0, 10);
  const snapshotAt = new Date();

  return transaction(async (conn) => {
    await conn.query(`DELETE FROM ranking_snapshots WHERE ranking_type = :type AND snapshot_date = :snapshotDate`, { type, snapshotDate });
    for (const row of rows) {
      await conn.query(
        `INSERT INTO ranking_snapshots (
          user_id, ranking_type, entity_type, entity_id, score_value, payload_json,
          snapshot_at, created_by_user_id, rank_position, snapshot_date, created_at, updated_at
        ) VALUES (
          :user_id, :ranking_type, :entity_type, :entity_id, :score_value, :payload_json,
          :snapshot_at, :created_by_user_id, :rank_position, :snapshot_date, NOW(), NOW()
        )`,
        {
          user_id: type === 'guild_power' ? null : row.entity_id,
          ranking_type: type,
          entity_type: type === 'guild_power' ? 'guild' : 'user',
          entity_id: row.entity_id,
          score_value: row.score_value,
          payload_json: JSON.stringify(row),
          snapshot_at: snapshotAt,
          created_by_user_id: actorUserId || null,
          rank_position: row.rank_position,
          snapshot_date: snapshotDate,
        }
      );
    }
    return { type, snapshotDate, inserted: rows.length };
  });
}

async function listAuthors() {
  return query(`SELECT * FROM authors ORDER BY name ASC`);
}

async function listComicsAdmin(filters = {}) {
  const page = Number(filters.page || 1);
  const limit = Number(filters.limit || 100);
  const offset = (page - 1) * limit;
  const keyword = filters.keyword || null;
  const publicationStatus = filters.publicationStatus || null;
  const items = await query(
    `SELECT c.id, c.author_id, c.title, c.slug, c.cover_image_url, c.banner_image_url, c.summary,
            c.publication_status, c.visibility_status, c.age_rating, c.total_views, c.total_follows, c.created_at, c.updated_at,
            a.name AS author_name,
            COUNT(DISTINCT ch.id) AS total_chapters,
            GROUP_CONCAT(DISTINCT g.id ORDER BY g.name SEPARATOR ',') AS genre_ids,
            GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR ', ') AS genres
     FROM comics c
     LEFT JOIN authors a ON a.id = c.author_id
     LEFT JOIN chapters ch ON ch.comic_id = c.id AND ch.deleted_at IS NULL
     LEFT JOIN comic_genres cg ON cg.comic_id = c.id
     LEFT JOIN genres g ON g.id = cg.genre_id
     WHERE (:keyword IS NULL OR c.title LIKE CONCAT('%', :keyword, '%') OR c.slug LIKE CONCAT('%', :keyword, '%'))
       AND (:publicationStatus IS NULL OR c.publication_status = :publicationStatus)
       AND c.deleted_at IS NULL
     GROUP BY c.id, a.name
     ORDER BY c.id DESC
     LIMIT :limit OFFSET :offset`,
    { keyword, publicationStatus, limit, offset }
  );
  const [authors, genres] = await Promise.all([listAuthors(), query(`SELECT * FROM genres ORDER BY name ASC`)]);
  return { page, limit, items, authors, genres };
}

async function createComicAdmin(actorUserId, payload = {}) {
  if (!payload.title || !payload.slug) throw new ApiError(400, 'title và slug là bắt buộc');
  return transaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO comics (
        author_id, title, slug, cover_image_url, banner_image_url, summary,
        publication_status, visibility_status, age_rating, created_by_user_id, created_at, updated_at
      ) VALUES (
        :author_id, :title, :slug, :cover_image_url, :banner_image_url, :summary,
        :publication_status, :visibility_status, :age_rating, :actorUserId, NOW(), NOW()
      )`,
      {
        author_id: toNullableInt(payload.author_id),
        title: payload.title,
        slug: payload.slug,
        cover_image_url: payload.cover_image_url || null,
        banner_image_url: payload.banner_image_url || null,
        summary: payload.summary || null,
        publication_status: payload.publication_status || 'draft',
        visibility_status: payload.visibility_status || 'public',
        age_rating: payload.age_rating || 'all',
        actorUserId: actorUserId || null,
      }
    );
    const comicId = result.insertId;
    if (Array.isArray(payload.genre_ids)) {
      for (const genreId of payload.genre_ids.map(Number).filter(Boolean)) {
        await conn.query(`INSERT INTO comic_genres (comic_id, genre_id, created_at) VALUES (:comic_id, :genre_id, NOW())`, { comic_id: comicId, genre_id: genreId });
      }
    }
    return { id: comicId };
  });
}

async function updateComicAdmin(id, payload = {}) {
  return transaction(async (conn) => {
    const rows = await queryWithConn(conn, `SELECT * FROM comics WHERE id = :id AND deleted_at IS NULL LIMIT 1`, { id });
    if (!rows.length) throw new ApiError(404, 'Không tìm thấy truyện');
    const current = rows[0];
    await conn.query(
      `UPDATE comics
       SET author_id = :author_id, title = :title, slug = :slug,
           cover_image_url = :cover_image_url, banner_image_url = :banner_image_url, summary = :summary,
           publication_status = :publication_status, visibility_status = :visibility_status, age_rating = :age_rating,
           updated_at = NOW()
       WHERE id = :id`,
      {
        id,
        author_id: payload.author_id ?? current.author_id,
        title: payload.title ?? current.title,
        slug: payload.slug ?? current.slug,
        cover_image_url: payload.cover_image_url ?? current.cover_image_url,
        banner_image_url: payload.banner_image_url ?? current.banner_image_url,
        summary: payload.summary ?? current.summary,
        publication_status: payload.publication_status ?? current.publication_status,
        visibility_status: payload.visibility_status ?? current.visibility_status,
        age_rating: payload.age_rating ?? current.age_rating,
      }
    );
    if (Array.isArray(payload.genre_ids)) {
      await conn.query(`DELETE FROM comic_genres WHERE comic_id = :id`, { id });
      for (const genreId of payload.genre_ids.map(Number).filter(Boolean)) {
        await conn.query(`INSERT INTO comic_genres (comic_id, genre_id, created_at) VALUES (:comic_id, :genre_id, NOW())`, { comic_id: id, genre_id: genreId });
      }
    }
    return { id: Number(id) };
  });
}

async function deleteComicAdmin(id) {
  await query(`UPDATE comics SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id`, { id });
  return { id: Number(id), deleted: true };
}

async function listChaptersAdmin(filters = {}) {
  const comicId = toNullableInt(filters.comicId);
  const publishStatus = filters.publishStatus || null;
  const keyword = filters.keyword ? `%${String(filters.keyword).trim()}%` : null;
  const items = await query(
    `SELECT ch.id, ch.comic_id, ch.chapter_number, ch.title, ch.slug, ch.access_type, ch.publish_status,
            ch.view_count, ch.released_at, ch.created_at,
            c.title AS comic_title,
            COUNT(ci.id) AS image_count
     FROM chapters ch
     INNER JOIN comics c ON c.id = ch.comic_id AND c.deleted_at IS NULL
     LEFT JOIN chapter_images ci ON ci.chapter_id = ch.id
     WHERE ch.deleted_at IS NULL
       AND (:comicId IS NULL OR ch.comic_id = :comicId)
       AND (:publishStatus IS NULL OR ch.publish_status = :publishStatus)
       AND (:keyword IS NULL OR CONCAT(IFNULL(ch.title,''), ' ', IFNULL(ch.slug,''), ' ', IFNULL(c.title,'')) LIKE :keyword)
     GROUP BY ch.id, c.title
     ORDER BY ch.created_at DESC`,
    { comicId, publishStatus, keyword }
  );
  const comics = await query(`SELECT id, title FROM comics WHERE deleted_at IS NULL ORDER BY title ASC`);
  return { items, comics };
}

async function getChapterAdminDetail(id) {
  const rows = await query(
    `SELECT ch.*, c.title AS comic_title
     FROM chapters ch
     INNER JOIN comics c ON c.id = ch.comic_id
     WHERE ch.id = :id AND ch.deleted_at IS NULL
     LIMIT 1`,
    { id }
  );
  if (!rows.length) throw new ApiError(404, 'Không tìm thấy chapter');
  const images = await query(`SELECT id, image_url, display_order FROM chapter_images WHERE chapter_id = :id ORDER BY display_order ASC`, { id });
  return { ...rows[0], images };
}

async function createChapterAdmin(payload = {}) {
  if (!payload.comic_id || payload.chapter_number === undefined || !payload.slug) throw new ApiError(400, 'comic_id, chapter_number và slug là bắt buộc');
  return transaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO chapters (
        comic_id, chapter_number, title, slug, summary, access_type, publish_status, released_at, created_at, updated_at
      ) VALUES (
        :comic_id, :chapter_number, :title, :slug, :summary, :access_type, :publish_status, :released_at, NOW(), NOW()
      )`,
      {
        comic_id: Number(payload.comic_id),
        chapter_number: Number(payload.chapter_number),
        title: payload.title || null,
        slug: payload.slug,
        summary: payload.summary || null,
        access_type: payload.access_type || 'free',
        publish_status: payload.publish_status || 'draft',
        released_at: payload.released_at || null,
      }
    );
    const chapterId = result.insertId;
    if (Array.isArray(payload.images)) {
      for (let i = 0; i < payload.images.length; i += 1) {
        const image = payload.images[i];
        if (!image?.image_url) continue;
        await conn.query(
          `INSERT INTO chapter_images (chapter_id, image_url, display_order) VALUES (:chapter_id, :image_url, :display_order)`,
          { chapter_id: chapterId, image_url: image.image_url, display_order: Number(image.display_order || i + 1) }
        );
      }
    }
    return { id: chapterId };
  });
}

async function updateChapterAdmin(id, payload = {}) {
  return transaction(async (conn) => {
    const rows = await queryWithConn(conn, `SELECT * FROM chapters WHERE id = :id AND deleted_at IS NULL LIMIT 1`, { id });
    if (!rows.length) throw new ApiError(404, 'Không tìm thấy chapter');
    const current = rows[0];
    await conn.query(
      `UPDATE chapters
       SET comic_id = :comic_id, chapter_number = :chapter_number, title = :title, slug = :slug,
           summary = :summary, access_type = :access_type, publish_status = :publish_status,
           released_at = :released_at, updated_at = NOW()
       WHERE id = :id`,
      {
        id,
        comic_id: payload.comic_id ?? current.comic_id,
        chapter_number: payload.chapter_number ?? current.chapter_number,
        title: payload.title ?? current.title,
        slug: payload.slug ?? current.slug,
        summary: payload.summary ?? current.summary,
        access_type: payload.access_type ?? current.access_type,
        publish_status: payload.publish_status ?? current.publish_status,
        released_at: payload.released_at ?? current.released_at,
      }
    );
    if (Array.isArray(payload.images)) {
      await conn.query(`DELETE FROM chapter_images WHERE chapter_id = :id`, { id });
      for (let i = 0; i < payload.images.length; i += 1) {
        const image = payload.images[i];
        if (!image?.image_url) continue;
        await conn.query(`INSERT INTO chapter_images (chapter_id, image_url, display_order) VALUES (:chapter_id, :image_url, :display_order)`, {
          chapter_id: id,
          image_url: image.image_url,
          display_order: Number(image.display_order || i + 1),
        });
      }
    }
    return { id: Number(id) };
  });
}

async function deleteChapterAdmin(id) {
  await query(`UPDATE chapters SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id`, { id });
  return { id: Number(id), deleted: true };
}

async function addChapterImagesAdmin(chapterId, images) {
  if (!chapterId) throw new ApiError(400, 'Thiếu chapter id');
  if (!Array.isArray(images) || images.length === 0) {
    throw new ApiError(400, 'Chưa có ảnh để thêm');
  }

  return transaction(async (conn) => {
    const chapterRows = await queryWithConn(
      conn,
      `SELECT id
       FROM chapters
       WHERE id = :chapterId AND deleted_at IS NULL
       LIMIT 1`,
      { chapterId }
    );

    if (!chapterRows.length) throw new ApiError(404, 'Không tìm thấy chapter');

    const maxOrderRows = await queryWithConn(
      conn,
      `SELECT COALESCE(MAX(display_order), 0) AS max_order
       FROM chapter_images
       WHERE chapter_id = :chapterId`,
      { chapterId }
    );

    let nextOrder = Number(maxOrderRows[0]?.max_order || 0) + 1;

    for (const image of images) {
      if (!image?.image_url) continue;

      await conn.query(
        `INSERT INTO chapter_images (chapter_id, image_url, display_order)
         VALUES (:chapter_id, :image_url, :display_order)`,
        {
          chapter_id: chapterId,
          image_url: image.image_url,
          display_order: nextOrder,
        }
      );

      nextOrder += 1;
    }

    return getChapterAdminDetail(chapterId);
  });
}

async function replaceChapterImageAdmin(imageId, imageUrl) {
  if (!imageId) throw new ApiError(400, 'Thiếu image id');
  if (!imageUrl) throw new ApiError(400, 'Thiếu ảnh mới');

  return transaction(async (conn) => {
    const rows = await queryWithConn(
      conn,
      `SELECT id, chapter_id
       FROM chapter_images
       WHERE id = :imageId
       LIMIT 1`,
      { imageId }
    );

    if (!rows.length) throw new ApiError(404, 'Không tìm thấy ảnh chapter');

    const chapterId = rows[0].chapter_id;

    await conn.query(
      `UPDATE chapter_images
       SET image_url = :image_url
       WHERE id = :imageId`,
      {
        image_url: imageUrl,
        imageId,
      }
    );

    return getChapterAdminDetail(chapterId);
  });
}

async function deleteChapterImageAdmin(imageId) {
  if (!imageId) throw new ApiError(400, 'Thiếu image id');

  return transaction(async (conn) => {
    const rows = await queryWithConn(
      conn,
      `SELECT id, chapter_id
       FROM chapter_images
       WHERE id = :imageId
       LIMIT 1`,
      { imageId }
    );

    if (!rows.length) throw new ApiError(404, 'Không tìm thấy ảnh chapter');

    const chapterId = rows[0].chapter_id;

    await conn.query(
      `DELETE FROM chapter_images WHERE id = :imageId`,
      { imageId }
    );

    const remainRows = await queryWithConn(
      conn,
      `SELECT id
       FROM chapter_images
       WHERE chapter_id = :chapterId
       ORDER BY display_order ASC, id ASC`,
      { chapterId }
    );

    if (remainRows.length > 0) {
      await conn.query(
        `UPDATE chapter_images
         SET display_order = display_order + 100000
         WHERE chapter_id = :chapterId`,
        { chapterId }
      );

      for (let i = 0; i < remainRows.length; i += 1) {
        await conn.query(
          `UPDATE chapter_images
           SET display_order = :display_order
           WHERE id = :id`,
          {
            display_order: i + 1,
            id: remainRows[i].id,
          }
        );
      }
    }

    return getChapterAdminDetail(chapterId);
  });
}

async function reorderChapterImagesAdmin(chapterId, images) {
  if (!chapterId) throw new ApiError(400, 'Thiếu chapter id');
  if (!Array.isArray(images) || images.length === 0) {
    throw new ApiError(400, 'Thiếu danh sách ảnh');
  }

  return transaction(async (conn) => {
    const chapterRows = await queryWithConn(
      conn,
      `SELECT id
       FROM chapters
       WHERE id = :chapterId AND deleted_at IS NULL
       LIMIT 1`,
      { chapterId }
    );

    if (!chapterRows.length) throw new ApiError(404, 'Không tìm thấy chapter');

    await conn.query(
      `UPDATE chapter_images
       SET display_order = display_order + 100000
       WHERE chapter_id = :chapterId`,
      { chapterId }
    );

    for (const item of images) {
      await conn.query(
        `UPDATE chapter_images
         SET display_order = :display_order
         WHERE id = :id AND chapter_id = :chapterId`,
        {
          display_order: Number(item.display_order),
          id: Number(item.id),
          chapterId,
        }
      );
    }

    return getChapterAdminDetail(chapterId);
  });
}

module.exports = {
  getDashboard,
  listGenres,
  createGenre,
  updateGenre,
  deleteGenre,
  listComments,
  updateCommentStatus,
  deleteComment,
  listUsersAdmin,
  getUserAdminDetail,
  createUserAdmin,
  updateUserAdmin,
  deleteUserAdmin,
  listGuildsAdmin,
  createGuildAdmin,
  updateGuildAdmin,
  deleteGuildAdmin,
  createGuildRoleAdmin,
  updateGuildRoleAdmin,
  deleteGuildRoleAdmin,
  reviewGuildJoinRequestAdmin,
  listCultivationAdmin,
  createRealm,
  updateRealm,
  deleteRealm,
  createLevel,
  updateLevel,
  deleteLevel,
  listMissionsAdmin,
  createMission,
  updateMission,
  deleteMission,
  listAfkAdmin,
  createAfkConfig,
  updateAfkConfig,
  deleteAfkConfig,
  listVipAdmin,
  createVipLevel,
  updateVipLevel,
  deleteVipLevel,
  createVipBenefit,
  updateVipBenefit,
  deleteVipBenefit,
  getRankingOverview,
  getRankingList,
  createRankingSnapshot,
  listAuthors,
  listComicsAdmin,
  createComicAdmin,
  updateComicAdmin,
  deleteComicAdmin,
  listChaptersAdmin,
  getChapterAdminDetail,
  createChapterAdmin,
  updateChapterAdmin,
  deleteChapterAdmin,
  addChapterImagesAdmin,
  replaceChapterImageAdmin,
  deleteChapterImageAdmin,
  reorderChapterImagesAdmin,
};