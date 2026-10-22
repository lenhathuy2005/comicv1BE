const { query, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

const ALLOWED_TYPES = ['power', 'level', 'vip', 'guild_power'];

function normalizeLimit(limit) {
  const parsed = Number(limit) || 20;
  return Math.min(Math.max(parsed, 1), 100);
}

function validateRankingType(type) {
  if (!ALLOWED_TYPES.includes(type)) {
    throw new ApiError(400, `Ranking type không hợp lệ. Chỉ hỗ trợ: ${ALLOWED_TYPES.join(', ')}`);
  }
}

function safeParseJson(value) {
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (_error) {
    return value;
  }
}

function toDateString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getAvailableRankingTypes() {
  return ALLOWED_TYPES.map((type) => ({
    type,
    label:
      type === 'power'
        ? 'BXH lực chiến'
        : type === 'level'
        ? 'BXH cấp độ'
        : type === 'vip'
        ? 'BXH VIP'
        : 'BXH bang hội',
  }));
}

async function getLatestSnapshotTime(type) {
  const rows = await query(
    `
    SELECT snapshot_at
    FROM ranking_snapshots
    WHERE ranking_type = :type
    ORDER BY snapshot_at DESC
    LIMIT 1
    `,
    { type }
  );

  return rows.length ? rows[0].snapshot_at : null;
}

async function getSnapshotRanking(type, limit, snapshotAt = null) {
  const finalSnapshotAt = snapshotAt || (await getLatestSnapshotTime(type));
  if (!finalSnapshotAt) return [];

  const rows = await query(
    `
    SELECT
      id,
      ranking_type,
      entity_type,
      entity_id,
      rank_position,
      score_value,
      payload_json,
      snapshot_at,
      snapshot_date
    FROM ranking_snapshots
    WHERE ranking_type = :type
      AND snapshot_at = :snapshotAt
    ORDER BY rank_position ASC
    LIMIT :limit
    `,
    {
      type,
      snapshotAt: finalSnapshotAt,
      limit,
    }
  );

  return rows.map((row) => ({
    id: row.id,
    rankingType: row.ranking_type,
    entityType: row.entity_type,
    entityId: Number(row.entity_id),
    rank: Number(row.rank_position),
    scoreValue: Number(row.score_value),
    snapshotAt: row.snapshot_at,
    snapshotDate: row.snapshot_date,
    data: safeParseJson(row.payload_json),
  }));
}

async function getLivePowerRanking(limit, fullList = false) {
  return query(
    `
    SELECT
      u.id AS user_id,
      u.username,
      u.display_name,
      u.avatar_url,
      uc.current_level_id,
      uc.current_realm_id,
      uc.current_exp,
      uc.total_exp_earned,
      uc.combat_power,
      uc.combat_power AS score_value,
      l.level_number,
      r.name AS realm_name
    FROM users u
    JOIN user_cultivation uc ON uc.user_id = u.id
    LEFT JOIN levels l ON l.id = uc.current_level_id
    LEFT JOIN realms r ON r.id = uc.current_realm_id
    ORDER BY uc.combat_power DESC, uc.total_exp_earned DESC, u.id ASC
    ${fullList ? '' : 'LIMIT :limit'}
    `,
    fullList ? {} : { limit }
  );
}

async function getLiveLevelRanking(limit, fullList = false) {
  return query(
    `
    SELECT
      u.id AS user_id,
      u.username,
      u.display_name,
      u.avatar_url,
      uc.current_level_id,
      uc.current_realm_id,
      uc.current_exp,
      uc.total_exp_earned,
      uc.combat_power,
      l.level_number,
      r.name AS realm_name,
      l.level_number AS score_value
    FROM users u
    JOIN user_cultivation uc ON uc.user_id = u.id
    LEFT JOIN levels l ON l.id = uc.current_level_id
    LEFT JOIN realms r ON r.id = uc.current_realm_id
    ORDER BY l.level_number DESC, uc.current_exp DESC, uc.combat_power DESC, u.id ASC
    ${fullList ? '' : 'LIMIT :limit'}
    `,
    fullList ? {} : { limit }
  );
}

async function getLiveVipRanking(limit, fullList = false) {
  return query(
    `
    SELECT
      u.id AS user_id,
      u.username,
      u.display_name,
      u.avatar_url,
      uv.current_vip_level_id,
      uv.total_topup_amount,
      uv.vip_exp,
      vl.level_number,
      vl.name AS vip_name,
      vl.level_number AS score_value
    FROM users u
    JOIN user_vip uv ON uv.user_id = u.id
    LEFT JOIN vip_levels vl ON vl.id = uv.current_vip_level_id
    ORDER BY vl.level_number DESC, uv.total_topup_amount DESC, uv.vip_exp DESC, u.id ASC
    ${fullList ? '' : 'LIMIT :limit'}
    `,
    fullList ? {} : { limit }
  );
}

async function getLiveGuildPowerRanking(limit, fullList = false) {
  return query(
    `
    SELECT
      g.id AS guild_id,
      g.name,
      g.slug,
      g.logo_url,
      g.level,
      g.contribution_points,
      g.guild_power AS score_value,
      g.guild_status,
      leader.id AS leader_user_id,
      leader.username AS leader_username,
      leader.display_name AS leader_display_name
    FROM guilds g
    LEFT JOIN users leader ON leader.id = g.leader_user_id
    ORDER BY g.guild_power DESC, g.level DESC, g.id ASC
    ${fullList ? '' : 'LIMIT :limit'}
    `,
    fullList ? {} : { limit }
  );
}

async function getLiveRanking(type, limit, fullList = false) {
  validateRankingType(type);

  if (type === 'power') return getLivePowerRanking(limit, fullList);
  if (type === 'level') return getLiveLevelRanking(limit, fullList);
  if (type === 'vip') return getLiveVipRanking(limit, fullList);
  if (type === 'guild_power') return getLiveGuildPowerRanking(limit, fullList);

  throw new ApiError(400, 'Ranking type không hợp lệ');
}

function mapLiveRows(type, rows) {
  if (type === 'guild_power') {
    return rows.map((row, index) => ({
      rank: index + 1,
      rankingType: type,
      entityType: 'guild',
      entityId: Number(row.guild_id),
      scoreValue: Number(row.score_value),
      data: {
        guildId: Number(row.guild_id),
        name: row.name,
        slug: row.slug,
        logoUrl: row.logo_url,
        level: row.level != null ? Number(row.level) : null,
        contributionPoints: row.contribution_points != null ? Number(row.contribution_points) : null,
        guildPower: Number(row.score_value),
        guildStatus: row.guild_status,
        leaderUserId: row.leader_user_id != null ? Number(row.leader_user_id) : null,
        leaderUsername: row.leader_username,
        leaderDisplayName: row.leader_display_name,
      },
    }));
  }

  return rows.map((row, index) => ({
    rank: index + 1,
    rankingType: type,
    entityType: 'user',
    entityId: Number(row.user_id),
    scoreValue: Number(row.score_value),
    data: {
      userId: Number(row.user_id),
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      currentLevelId: row.current_level_id != null ? Number(row.current_level_id) : null,
      currentRealmId: row.current_realm_id != null ? Number(row.current_realm_id) : null,
      currentExp: row.current_exp != null ? Number(row.current_exp) : null,
      totalExpEarned: row.total_exp_earned != null ? Number(row.total_exp_earned) : null,
      combatPower: row.combat_power != null ? Number(row.combat_power) : null,
      levelNumber: row.level_number != null ? Number(row.level_number) : null,
      realmName: row.realm_name || null,
      currentVipLevelId: row.current_vip_level_id != null ? Number(row.current_vip_level_id) : null,
      totalTopupAmount: row.total_topup_amount != null ? Number(row.total_topup_amount) : null,
      vipExp: row.vip_exp != null ? Number(row.vip_exp) : null,
      vipName: row.vip_name || null,
    },
  }));
}

async function listRankings(type, limit = 20, preferSnapshot = true) {
  validateRankingType(type);
  const finalLimit = normalizeLimit(limit);

  if (preferSnapshot) {
    const snapshotRows = await getSnapshotRanking(type, finalLimit);
    if (snapshotRows.length) {
      return {
        source: 'snapshot',
        type,
        limit: finalLimit,
        items: snapshotRows,
      };
    }
  }

  const liveRows = await getLiveRanking(type, finalLimit, false);
  return {
    source: 'live',
    type,
    limit: finalLimit,
    items: mapLiveRows(type, liveRows),
  };
}

async function getMyRanking(type, userId) {
  validateRankingType(type);

  if (type === 'guild_power') {
    throw new ApiError(400, 'guild_power không hỗ trợ route /me');
  }

  const latestSnapshotAt = await getLatestSnapshotTime(type);

  if (latestSnapshotAt) {
    const snapshotRows = await getSnapshotRanking(type, 1000, latestSnapshotAt);
    const foundSnapshot = snapshotRows.find((item) => {
      const payloadUserId = item?.data?.userId != null ? Number(item.data.userId) : null;
      return Number(item.entityId) === Number(userId) || payloadUserId === Number(userId);
    });

    if (foundSnapshot) {
      return {
        source: 'snapshot',
        ...foundSnapshot,
      };
    }
  }

  const rows = await getLiveRanking(type, 100000, true);
  const mapped = mapLiveRows(type, rows);
  const found = mapped.find((item) => Number(item.entityId) === Number(userId));

  if (!found) {
    throw new ApiError(404, 'Không tìm thấy user trong bảng xếp hạng này');
  }

  return {
    source: 'live',
    ...found,
  };
}

async function createRankingSnapshot(type, actorUserId, limit = 100) {
  validateRankingType(type);
  const finalLimit = normalizeLimit(limit);
  const liveRows = await getLiveRanking(type, finalLimit, false);
  const mappedRows = mapLiveRows(type, liveRows);

  if (!mappedRows.length) {
    throw new ApiError(400, 'Không có dữ liệu để tạo snapshot');
  }

  const snapshotAt = new Date();
  const snapshotDate = toDateString(snapshotAt);

  await transaction(async (conn) => {
    for (const item of mappedRows) {
      await conn.execute(
        `
        INSERT INTO ranking_snapshots
        (ranking_type, entity_type, entity_id, rank_position, score_value, payload_json, snapshot_at, snapshot_date, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          item.rankingType,
          item.entityType,
          item.entityId,
          item.rank,
          item.scoreValue,
          JSON.stringify(item.data),
          snapshotAt,
          snapshotDate,
          actorUserId || null,
        ]
      );
    }
  });

  return {
    message: 'Tạo ranking snapshot thành công',
    type,
    itemCount: mappedRows.length,
    snapshotAt,
    snapshotDate,
  };
}

module.exports = {
  getAvailableRankingTypes,
  listRankings,
  getMyRanking,
  createRankingSnapshot,
};