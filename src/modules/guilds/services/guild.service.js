const { query, queryWithConn, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

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

  const chatRoomRows = await query(
    `
    SELECT id
    FROM chat_rooms
    WHERE guild_id = :guildId
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
      member_limit: Number(guild.member_limit || 0),
      level: Number(guild.level || 0),
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

async function createGuild({ userId, name, slug, description = null }) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  if (!name || !slug) {
    throw new ApiError(400, 'name và slug là bắt buộc');
  }

  return transaction(async (conn) => {
    const existingGuild = await queryWithConn(
      conn,
      `
      SELECT id
      FROM guilds
      WHERE name = :name OR slug = :slug
      LIMIT 1
      `,
      { name, slug }
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

    const roleRows = await queryWithConn(
      conn,
      `
      SELECT id
      FROM guild_roles
      ORDER BY hierarchy_level ASC
      LIMIT 1
      `
    );

    if (!roleRows.length) {
      throw new ApiError(500, 'Thiếu dữ liệu guild_roles');
    }

    const leaderRoleId = roleRows[0].id;

    const [guildResult] = await conn.query(
      `
      INSERT INTO guilds (
        name,
        slug,
        description,
        leader_user_id,
        member_limit,
        level,
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
        :userId,
        30,
        1,
        0,
        0,
        'active',
        NOW(),
        NOW()
      )
      `,
      {
        name,
        slug,
        description,
        userId,
      }
    );

    const guildId = guildResult.insertId;

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
        'Tạo bang hội',
        NOW()
      )
      `,
      {
        guildId,
        userId,
      }
    );

    return getGuildDetail(guildId);
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
      gr.hierarchy_level
    FROM guild_members gm
    LEFT JOIN users u ON u.id = gm.user_id
    LEFT JOIN guild_roles gr ON gr.id = gm.guild_role_id
    WHERE gm.guild_id = :guildId
      AND gm.join_status = 'active'
    ORDER BY gr.hierarchy_level ASC, gm.contribution_points DESC, gm.joined_at ASC
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

async function updateGuild({ guildId, userId, name, slug, logoUrl, description, memberLimit, guildStatus }) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  await ensureCanManageGuild(guildId, userId);
  const guild = await getGuildById(guildId);

  const nextName = name?.trim?.() ?? guild.name;
  const nextSlug = slug?.trim?.() ?? guild.slug;
  const nextLogoUrl = logoUrl?.trim?.() ?? guild.logo_url;
  const nextDescription = description?.trim?.() ?? guild.description;
  const nextMemberLimit = memberLimit !== undefined ? Number(memberLimit) : Number(guild.member_limit);
  const nextGuildStatus = guildStatus ?? guild.guild_status;

  if (!nextName) {
    throw new ApiError(400, 'name là bắt buộc');
  }

  if (!nextSlug) {
    throw new ApiError(400, 'slug là bắt buộc');
  }

  if (Number.isNaN(nextMemberLimit) || nextMemberLimit <= 0) {
    throw new ApiError(400, 'memberLimit phải lớn hơn 0');
  }

  const allowedStatuses = ['active', 'locked', 'disbanded'];
  if (!allowedStatuses.includes(nextGuildStatus)) {
    throw new ApiError(400, 'guildStatus không hợp lệ');
  }

  const duplicateRows = await query(
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

  await query(
    `
    UPDATE guilds
    SET name = :name,
        slug = :slug,
        logo_url = :logoUrl,
        description = :description,
        member_limit = :memberLimit,
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
      memberLimit: nextMemberLimit,
      guildStatus: nextGuildStatus,
    }
  );

  return getGuildDetail(guildId);
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
  getGuildDetail,
  getGuildDetailAggregate,
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
  updateGuild,
  updateGuildAnnouncement,
  donateToGuild,
};
