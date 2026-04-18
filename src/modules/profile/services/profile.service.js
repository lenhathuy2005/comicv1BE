const { query } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

async function getUserBasic(userId) {
  const rows = await query(
    `
    SELECT
      id,
      username,
      email,
      display_name,
      avatar_url,
      status,
      account_status,
      is_verified,
      is_email_verified,
      current_guild_id,
      created_at,
      updated_at
    FROM users
    WHERE id = :userId
      AND deleted_at IS NULL
    LIMIT 1
    `,
    { userId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy user');
  }

  return rows[0];
}

async function getUserProfileRow(userId) {
  const rows = await query(
    `
    SELECT *
    FROM user_profiles
    WHERE user_id = :userId
    LIMIT 1
    `,
    { userId }
  );

  return rows[0] || null;
}

async function getCultivationSummary(userId) {
  const rows = await query(
    `
    SELECT
      uc.current_exp,
      uc.total_exp_earned,
      uc.breakthrough_count,
      uc.spirit_stones,
      uc.reputation_points,
      uc.combat_power,
      uc.last_breakthrough_at,
      l.id AS level_id,
      l.level_number,
      l.name AS level_name,
      r.id AS realm_id,
      r.name AS realm_name
    FROM user_cultivation uc
    LEFT JOIN levels l ON l.id = uc.current_level_id
    LEFT JOIN realms r ON r.id = uc.current_realm_id
    WHERE uc.user_id = :userId
    LIMIT 1
    `,
    { userId }
  );

  return rows[0] || null;
}

async function getVipSummary(userId) {
  const rows = await query(
    `
    SELECT
      uv.total_topup_amount,
      uv.vip_exp,
      uv.vip_started_at,
      uv.last_level_up_at,
      vl.id AS vip_level_id,
      vl.level_number AS vip_level,
      vl.name AS vip_level_name,
      vl.badge_name,
      vl.badge_color,
      vl.required_topup_amount
    FROM user_vip uv
    LEFT JOIN vip_levels vl ON vl.id = uv.current_vip_level_id
    WHERE uv.user_id = :userId
    LIMIT 1
    `,
    { userId }
  );

  return rows[0] || null;
}

async function getGuildSummary(userId) {
  const rows = await query(
    `
    SELECT
      gm.guild_id,
      gm.join_status,
      gm.joined_at,
      gm.contribution_points,
      g.name AS guild_name,
      g.slug AS guild_slug,
      g.logo_url AS guild_logo_url,
      g.level AS guild_level,
      g.guild_power,
      gr.id AS guild_role_id,
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
    INNER JOIN guilds g ON g.id = gm.guild_id
    LEFT JOIN guild_roles gr ON gr.id = gm.guild_role_id
    WHERE gm.user_id = :userId
      AND gm.join_status = 'active'
    LIMIT 1
    `,
    { userId }
  );

  return rows[0] || null;
}

async function getProfileStats(userId) {
  const [followCountRow] = await query(
    `SELECT COUNT(*) AS total FROM follows WHERE user_id = :userId`,
    { userId }
  );
  const [inventoryCountRow] = await query(
    `SELECT COALESCE(SUM(quantity), 0) AS total FROM user_inventory WHERE user_id = :userId`,
    { userId }
  );
  const [missionClaimedCountRow] = await query(
    `SELECT COUNT(*) AS total FROM user_missions WHERE user_id = :userId AND mission_status = 'claimed'`,
    { userId }
  );
  const [checkinCountRow] = await query(
    `SELECT COUNT(*) AS total FROM daily_checkins WHERE user_id = :userId`,
    { userId }
  );

  return {
    follow_count: Number(followCountRow?.total || 0),
    inventory_count: Number(inventoryCountRow?.total || 0),
    mission_claimed_count: Number(missionClaimedCountRow?.total || 0),
    checkin_count: Number(checkinCountRow?.total || 0),
  };
}

async function getMyProfile(userId) {
  const [user, profile, cultivation, vip, guild, stats] = await Promise.all([
    getUserBasic(userId),
    getUserProfileRow(userId),
    getCultivationSummary(userId),
    getVipSummary(userId),
    getGuildSummary(userId),
    getProfileStats(userId),
  ]);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      status: user.status,
      account_status: user.account_status,
      is_verified: Boolean(user.is_verified),
      is_email_verified: Boolean(user.is_email_verified),
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    profile: profile
      ? {
          full_name: profile.full_name || null,
          phone_number: profile.phone_number || null,
          bio: profile.bio || null,
          gender: profile.gender || null,
          birth_date: profile.birth_date || null,
          country: profile.country || null,
        }
      : null,
    resources: {
      gold_balance: Number(profile?.gold_balance || 0),
      premium_currency: Number(profile?.premium_currency || 0),
      energy: Number(profile?.energy || 0),
      stamina: Number(profile?.stamina || 0),
      spirit_stones: Number(cultivation?.spirit_stones || 0),
      reputation_points: Number(cultivation?.reputation_points || 0),
    },
    combat: {
      power_score: Number(profile?.power_score || 0),
      current_title: profile?.current_title || null,
      combat_power: Number(cultivation?.combat_power || 0),
    },
    cultivation_summary: cultivation
      ? {
          level_id: cultivation.level_id,
          level_number: cultivation.level_number,
          level_name: cultivation.level_name,
          realm_id: cultivation.realm_id,
          realm_name: cultivation.realm_name,
          current_exp: Number(cultivation.current_exp || 0),
          total_exp_earned: Number(cultivation.total_exp_earned || 0),
          breakthrough_count: Number(cultivation.breakthrough_count || 0),
          last_breakthrough_at: cultivation.last_breakthrough_at,
        }
      : null,
    vip_summary: vip
      ? {
          vip_level_id: vip.vip_level_id,
          vip_level: Number(vip.vip_level || 0),
          vip_level_name: vip.vip_level_name,
          vip_exp: Number(vip.vip_exp || 0),
          total_topup_amount: Number(vip.total_topup_amount || 0),
          badge_name: vip.badge_name || null,
          badge_color: vip.badge_color || null,
          required_topup_amount: Number(vip.required_topup_amount || 0),
          vip_started_at: vip.vip_started_at,
          last_level_up_at: vip.last_level_up_at,
        }
      : null,
    guild_summary: guild
      ? {
          guild_id: guild.guild_id,
          guild_name: guild.guild_name,
          guild_slug: guild.guild_slug,
          guild_logo_url: guild.guild_logo_url,
          guild_level: Number(guild.guild_level || 0),
          guild_power: Number(guild.guild_power || 0),
          join_status: guild.join_status,
          joined_at: guild.joined_at,
          contribution_points: Number(guild.contribution_points || 0),
          guild_role_id: guild.guild_role_id,
          role_code: guild.role_code,
          role_name: guild.role_name,
          hierarchy_level: guild.hierarchy_level,
        }
      : null,
    stats,
  };
}

async function ensureProfileRow(userId) {
  const existingProfile = await getUserProfileRow(userId);
  if (existingProfile) {
    return existingProfile;
  }

  await query(
    `
    INSERT INTO user_profiles (
      user_id,
      created_at,
      updated_at
    )
    VALUES (
      :userId,
      NOW(),
      NOW()
    )
    `,
    { userId }
  );

  return getUserProfileRow(userId);
}

async function updateMyProfile(userId, payload) {
  const user = await getUserBasic(userId);
  const currentProfile = await ensureProfileRow(userId);

  const displayName = payload.display_name?.trim?.() ?? null;
  const avatarUrl = payload.avatar_url?.trim?.() ?? null;
  const fullName = payload.full_name?.trim?.() ?? null;
  const phoneNumber = payload.phone_number?.trim?.() ?? null;
  const bio = payload.bio?.trim?.() ?? null;
  const gender = payload.gender ?? null;
  const birthDate = payload.birth_date ?? null;
  const country = payload.country?.trim?.() ?? null;

  const allowedGenders = ['male', 'female', 'other', 'unknown'];

  if (displayName && displayName.length > 100) {
    throw new ApiError(400, 'display_name không được vượt quá 100 ký tự');
  }

  if (avatarUrl && avatarUrl.length > 255) {
    throw new ApiError(400, 'avatar_url không được vượt quá 255 ký tự');
  }

  if (fullName && fullName.length > 150) {
    throw new ApiError(400, 'full_name không được vượt quá 150 ký tự');
  }

  if (phoneNumber && phoneNumber.length > 30) {
    throw new ApiError(400, 'phone_number không được vượt quá 30 ký tự');
  }

  if (bio && bio.length > 1000) {
    throw new ApiError(400, 'bio không được vượt quá 1000 ký tự');
  }

  if (country && country.length > 100) {
    throw new ApiError(400, 'country không được vượt quá 100 ký tự');
  }

  if (gender && !allowedGenders.includes(gender)) {
    throw new ApiError(400, 'gender không hợp lệ');
  }

  await query(
    `
    UPDATE users
    SET display_name = :displayName,
        avatar_url = :avatarUrl,
        updated_at = NOW()
    WHERE id = :userId
    `,
    {
      userId,
      displayName: displayName !== null ? displayName : user.display_name,
      avatarUrl: avatarUrl !== null ? avatarUrl : user.avatar_url,
    }
  );

  await query(
    `
    UPDATE user_profiles
    SET full_name = :fullName,
        phone_number = :phoneNumber,
        bio = :bio,
        gender = :gender,
        birth_date = :birthDate,
        country = :country,
        updated_at = NOW()
    WHERE user_id = :userId
    `,
    {
      userId,
      fullName: fullName !== null ? fullName : currentProfile.full_name,
      phoneNumber: phoneNumber !== null ? phoneNumber : currentProfile.phone_number,
      bio: bio !== null ? bio : currentProfile.bio,
      gender: gender !== null ? gender : currentProfile.gender,
      birthDate: birthDate !== null ? birthDate : currentProfile.birth_date,
      country: country !== null ? country : currentProfile.country,
    }
  );

  return getMyProfile(userId);
}

async function getMyActivities(userId, limit = 20) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 20), 50));

  const rows = await query(
    `
    SELECT *
    FROM (
      SELECT
        'checkin' AS activity_type,
        dc.id AS reference_id,
        CONCAT('Điểm danh ngày ', DATE_FORMAT(dc.checkin_date, '%Y-%m-%d')) AS title,
        CONCAT('Nhận ', dc.reward_gold, ' vàng và ', dc.reward_exp, ' exp') AS description,
        dc.created_at AS activity_at
      FROM daily_checkins dc
      WHERE dc.user_id = :userId

      UNION ALL

      SELECT
        'mission_claim' AS activity_type,
        um.id AS reference_id,
        m.title AS title,
        CONCAT('Đã claim nhiệm vụ: ', m.title) AS description,
        um.claimed_at AS activity_at
      FROM user_missions um
      INNER JOIN missions m ON m.id = um.mission_id
      WHERE um.user_id = :userId
        AND um.claimed_at IS NOT NULL

      UNION ALL

      SELECT
        'payment' AS activity_type,
        pt.id AS reference_id,
        CONCAT('Thanh toán ', pt.payment_method) AS title,
        CONCAT('Nạp ', pt.amount, ' ', pt.currency_code, ' - trạng thái ', pt.payment_status) AS description,
        COALESCE(pt.completed_at, pt.created_at) AS activity_at
      FROM payment_transactions pt
      WHERE pt.user_id = :userId

      UNION ALL

      SELECT
        'guild_donation' AS activity_type,
        gd.id AS reference_id,
        'Đóng góp bang hội' AS title,
        CONCAT('Đóng góp ', gd.amount, ' qua ', gd.donation_type) AS description,
        gd.donated_at AS activity_at
      FROM guild_donations gd
      WHERE gd.user_id = :userId
    ) AS activities
    ORDER BY activity_at DESC
    LIMIT ${safeLimit}
    `,
    { userId }
  );

  return { items: rows };
}

async function getMyFollows(userId) {
  const rows = await query(
    `
    SELECT
      f.id,
      f.comic_id,
      f.created_at,
      c.title,
      c.slug,
      c.cover_image_url,
      c.publication_status,
      c.total_views,
      c.total_follows
    FROM follows f
    INNER JOIN comics c ON c.id = f.comic_id
    WHERE f.user_id = :userId
    ORDER BY f.created_at DESC
    `,
    { userId }
  );

  return { items: rows };
}

async function getMyGuild(userId) {
  const membership = await getGuildSummary(userId);

  if (!membership) {
    return {
      is_member: false,
      guild: null,
    };
  }

  return {
    is_member: true,
    guild: membership,
  };
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  getMyActivities,
  getMyFollows,
  getMyGuild,
};
