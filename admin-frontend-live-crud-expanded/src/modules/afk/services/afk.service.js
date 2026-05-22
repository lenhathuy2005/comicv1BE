const { query, queryWithConn, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');
const cultivationService = require('../../cultivation/services/cultivation.service');

const DEFAULT_AFK_CONFIGS = [
  {
    config_key: 'afk_enabled',
    config_value: 'true',
    value_type: 'bool',
    description: 'Bật hoặc tắt toàn bộ hệ thống AFK',
  },
  {
    config_key: 'afk_exp_per_minute',
    config_value: '10',
    value_type: 'decimal',
    description: 'EXP cơ bản nhận được mỗi phút AFK',
  },
  {
    config_key: 'afk_gold_per_minute',
    config_value: '2',
    value_type: 'decimal',
    description: 'Vàng cơ bản nhận được mỗi phút AFK',
  },
  {
    config_key: 'afk_bonus_percent',
    config_value: '0',
    value_type: 'decimal',
    description: 'Phần trăm thưởng cộng thêm chung cho AFK',
  },
  {
    config_key: 'afk_vip_bonus_percent',
    config_value: '20',
    value_type: 'decimal',
    description: 'Phần trăm thưởng cộng thêm cho tài khoản VIP',
  },
  {
    config_key: 'afk_min_minutes_to_claim',
    config_value: '0',
    value_type: 'int',
    description: 'Số phút tối thiểu cần AFK để được nhận thưởng. 0 nghĩa là AFK bao lâu cũng nhận được.',
  },
  {
    config_key: 'afk_max_minutes_per_session',
    config_value: '480',
    value_type: 'int',
    description: 'Số phút tối đa được tính thưởng trong một phiên AFK',
  },
  {
    config_key: 'afk_daily_max_minutes',
    config_value: '720',
    value_type: 'int',
    description: 'Tổng số phút AFK tối đa được tính thưởng mỗi ngày',
  },
  {
    config_key: 'afk_banner_image_url',
    config_value: '/uploads/afk/afk-banner.png',
    value_type: 'string',
    description: 'Ảnh banner hiển thị ở màn AFK mobile',
  },
];

function mergeDefaultAfkConfigs(rows) {
  const existingKeys = new Set(rows.map((row) => row.config_key));
  const output = [...rows];

  let virtualId = -1;

  for (const item of DEFAULT_AFK_CONFIGS) {
    if (existingKeys.has(item.config_key)) continue;

    output.push({
      id: virtualId,
      ...item,
      created_at: null,
      updated_at: null,
    });

    virtualId -= 1;
  }

  return output;
}


function calculateDurationSeconds(startedAt, endedAt = new Date()) {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();

  return Math.max(0, Math.floor((end - start) / 1000));
}

function parseConfigValue(rawValue, valueType) {
  if (rawValue === null || rawValue === undefined) return null;

  switch (valueType) {
    case 'int':
      return Number.parseInt(rawValue, 10) || 0;

    case 'decimal':
      return Number(rawValue) || 0;

    case 'bool':
      return (
        rawValue === true ||
        rawValue === 'true' ||
        rawValue === '1' ||
        rawValue === 1
      );

    case 'json':
      try {
        return typeof rawValue === 'string'
          ? JSON.parse(rawValue)
          : rawValue;
      } catch (_error) {
        return rawValue;
      }

    case 'string':
    default:
      return rawValue;
  }
}

function tryNumber(value) {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(value);

  return Number.isNaN(parsed) ? null : parsed;
}

function extractNumericFromConfigValue(configValue, options = {}) {
  const { levelId = null, preferredKeys = [] } = options;

  const direct = tryNumber(configValue);
  if (direct !== null) return direct;

  if (!configValue || typeof configValue !== 'object') {
    return null;
  }

  if (levelId !== null && configValue[levelId] !== undefined) {
    const levelDirect = tryNumber(configValue[levelId]);

    if (levelDirect !== null) return levelDirect;
  }

  for (const key of preferredKeys) {
    if (configValue[key] !== undefined) {
      const byKey = tryNumber(configValue[key]);

      if (byKey !== null) return byKey;
    }
  }

  const commonKeys = [
    'value',
    'default',
    'base',
    'amount',
    'exp_per_minute',
    'gold_per_minute',
    'bonus_percent',
    'percent',
  ];

  for (const key of commonKeys) {
    if (configValue[key] !== undefined) {
      const byKey = tryNumber(configValue[key]);

      if (byKey !== null) return byKey;
    }
  }

  return null;
}

function extractBooleanFromConfigValue(configValue, fallback = true) {
  if (typeof configValue === 'boolean') return configValue;

  if (typeof configValue === 'number') {
    return configValue === 1;
  }

  if (typeof configValue === 'string') {
    const text = configValue.trim().toLowerCase();

    if (['true', '1', 'yes', 'on', 'enabled'].includes(text)) {
      return true;
    }

    if (['false', '0', 'no', 'off', 'disabled'].includes(text)) {
      return false;
    }
  }

  return fallback;
}

async function listConfigs() {
  const rows = await query(`
    SELECT
      id,
      config_key,
      config_value,
      value_type,
      description,
      created_at,
      updated_at
    FROM afk_configs
    ORDER BY id ASC
  `);

  return mergeDefaultAfkConfigs(rows).map((row) => ({
    ...row,
    parsed_value: parseConfigValue(row.config_value, row.value_type),
  }));
}

async function getRunningSession(userId) {
  const rows = await query(
    `
    SELECT *
    FROM afk_sessions
    WHERE user_id = :userId
      AND (
        session_status = 'running'
        OR (
          session_status = 'finished'
          AND claim_status = 'pending'
        )
      )
    ORDER BY
      CASE WHEN session_status = 'running' THEN 0 ELSE 1 END ASC,
      id DESC
    LIMIT 1
    `,
    { userId }
  );

  return rows[0] || null;
}

async function getAfkConfigMap() {
  const rows = await query(`
    SELECT
      config_key,
      config_value,
      value_type
    FROM afk_configs
  `);

  const map = {};

  for (const row of mergeDefaultAfkConfigs(rows)) {
    map[row.config_key] = parseConfigValue(
      row.config_value,
      row.value_type
    );
  }

  return map;
}

async function getUserCultivation(userId, conn = null) {
  const sql = `
    SELECT *
    FROM user_cultivation
    WHERE user_id = :userId
    LIMIT 1
  `;

  const rows = conn
    ? await queryWithConn(conn, sql, { userId })
    : await query(sql, { userId });

  return rows[0] || null;
}

async function getUserLevelAfkStats(userId, conn) {
  const rows = await queryWithConn(
    conn,
    `
    SELECT l.afk_multiplier, l.afk_exp_per_min, l.afk_gold_per_min
    FROM user_cultivation uc
    LEFT JOIN levels l ON l.id = uc.current_level_id
    WHERE uc.user_id = :userId
    LIMIT 1
    `,
    { userId }
  );

  return rows[0] || { afk_multiplier: 1, afk_exp_per_min: null, afk_gold_per_min: null };
}


async function ensureUserProfileRewardRow(userId, claimedGold, conn) {
  await conn.query(
    `
    INSERT INTO user_profiles (
      user_id,
      gold_balance,
      created_at,
      updated_at
    )
    VALUES (
      :userId,
      :claimedGold,
      NOW(),
      NOW()
    )
    ON DUPLICATE KEY UPDATE
      gold_balance = gold_balance + VALUES(gold_balance),
      updated_at = NOW()
    `,
    {
      userId,
      claimedGold,
    }
  );
}

async function refreshUserLevelByExp(userId, conn) {
  const rows = await queryWithConn(
    conn,
    `
    SELECT current_exp
    FROM user_cultivation
    WHERE user_id = :userId
    LIMIT 1
    `,
    { userId }
  );

  const currentExp = Number(rows[0]?.current_exp || 0);

  const levelRows = await queryWithConn(
    conn,
    `
    SELECT id
    FROM levels
    ORDER BY
      CASE WHEN exp_required <= :currentExp THEN 0 ELSE 1 END ASC,
      CASE WHEN exp_required <= :currentExp THEN exp_required END DESC,
      exp_required ASC,
      level_number ASC
    LIMIT 1
    `,
    { currentExp }
  );

  const nextLevelId = Number(levelRows[0]?.id || 0);

  if (nextLevelId <= 0) return;

  await conn.query(
    `
    UPDATE user_cultivation
    SET current_level_id = :nextLevelId,
        updated_at = NOW()
    WHERE user_id = :userId
      AND current_level_id <> :nextLevelId
    `,
    {
      userId,
      nextLevelId,
    }
  );
}

async function getUserVipBonusPercent(userId, conn, configMap) {
  const rows = await queryWithConn(
    conn,
    `
    SELECT current_vip_level_id
    FROM user_vip
    WHERE user_id = :userId
    LIMIT 1
    `,
    { userId }
  );

  const vipLevelId = Number(rows[0]?.current_vip_level_id || 0);

  if (vipLevelId <= 0) return 0;

  const rawVipBonus =
    configMap.afk_vip_bonus_percent ??
    configMap.vip_afk_bonus_percent ??
    0;

  return (
    extractNumericFromConfigValue(rawVipBonus, {
      levelId: vipLevelId,
      preferredKeys: [
        'vip_bonus_percent',
        'afk_vip_bonus_percent',
        'bonus_percent',
        'percent',
      ],
    }) ?? 0
  );
}

async function getTodayUsedAfkSeconds(userId, conn) {
  const rows = await queryWithConn(
    conn,
    `
    SELECT COALESCE(SUM(duration_seconds), 0) AS total_seconds
    FROM afk_sessions
    WHERE user_id = :userId
      AND DATE(created_at) = CURDATE()
      AND session_status IN ('finished', 'cancelled')
    `,
    { userId }
  );

  return Number(rows[0]?.total_seconds || 0);
}

async function startSession(userId) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  const configMap = await getAfkConfigMap();

  const afkEnabled = extractBooleanFromConfigValue(
    configMap.afk_enabled,
    true
  );

  if (!afkEnabled) {
    throw new ApiError(403, 'Hệ thống AFK hiện đang tạm tắt');
  }

  return transaction(async (conn) => {
    const cultivation = await getUserCultivation(userId, conn);

    if (!cultivation) {
      throw new ApiError(404, 'Không tìm thấy dữ liệu tu luyện của người dùng');
    }

    const runningRows = await queryWithConn(
      conn,
      `
      SELECT *
      FROM afk_sessions
      WHERE user_id = :userId
        AND session_status = 'running'
      LIMIT 1
      `,
      { userId }
    );

    if (runningRows.length) {
      throw new ApiError(400, 'Bạn đang có một phiên AFK đang chạy');
    }

    const [result] = await conn.query(
      `
      INSERT INTO afk_sessions (
        user_id,
        started_at,
        duration_seconds,
        base_exp_earned,
        bonus_exp_earned,
        total_exp_earned,
        base_gold_earned,
        bonus_gold_earned,
        total_gold_earned,
        claim_status,
        session_status,
        created_at,
        updated_at
      )
      VALUES (
        :userId,
        NOW(),
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        'pending',
        'running',
        NOW(),
        NOW()
      )
      `,
      { userId }
    );

    const rows = await queryWithConn(
      conn,
      `
      SELECT *
      FROM afk_sessions
      WHERE id = :id
      LIMIT 1
      `,
      { id: result.insertId }
    );

    return rows[0];
  });
}

async function finishSession(userId, sessionId) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  return transaction(async (conn) => {
    const rows = await queryWithConn(
      conn,
      `
      SELECT *
      FROM afk_sessions
      WHERE id = :sessionId
        AND user_id = :userId
      LIMIT 1
      `,
      { sessionId, userId }
    );

    if (!rows.length) {
      throw new ApiError(404, 'Không tìm thấy phiên AFK');
    }

    const session = rows[0];

    if (session.session_status !== 'running') {
      throw new ApiError(
        400,
        'Phiên AFK này không còn ở trạng thái running'
      );
    }

    const cultivation = await getUserCultivation(userId, conn);

    if (!cultivation) {
      throw new ApiError(404, 'Không tìm thấy dữ liệu tu luyện của người dùng');
    }

    const configMap = await getAfkConfigMap();

    const actualDurationSeconds = calculateDurationSeconds(session.started_at);

    const maxMinutesPerSession =
      extractNumericFromConfigValue(
        configMap.afk_max_minutes_per_session ?? 480,
        {
          preferredKeys: [
            'max_minutes_per_session',
            'afk_max_minutes_per_session',
            'minutes',
          ],
        }
      ) ?? 480;

    const dailyMaxMinutes =
      extractNumericFromConfigValue(
        configMap.afk_daily_max_minutes ?? 720,
        {
          preferredKeys: [
            'daily_max_minutes',
            'afk_daily_max_minutes',
            'minutes',
          ],
        }
      ) ?? 720;

    const usedTodaySeconds = await getTodayUsedAfkSeconds(userId, conn);

    const sessionCapSeconds = Math.max(
      0,
      Math.floor(maxMinutesPerSession * 60)
    );

    const dailyRemainingSeconds = Math.max(
      0,
      Math.floor(dailyMaxMinutes * 60) - usedTodaySeconds
    );

    const rewardableSeconds = Math.max(
      0,
      Math.min(
        actualDurationSeconds,
        sessionCapSeconds,
        dailyRemainingSeconds
      )
    );

    const rawExpConfig =
      configMap.afk_exp_per_minute ??
      configMap.afk_base_exp_per_minute ??
      configMap.base_exp_per_minute ??
      10;

    const rawGoldConfig =
      configMap.afk_gold_per_minute ??
      configMap.base_gold_per_minute ??
      0;

    const rawCommonBonusConfig =
      configMap.afk_bonus_percent ??
      configMap.bonus_percent ??
      0;

    const expPerMinute =
      extractNumericFromConfigValue(rawExpConfig, {
        levelId: cultivation.current_level_id,
        preferredKeys: [
          'exp_per_minute',
          'base_exp_per_minute',
          'exp',
        ],
      }) ?? 10;

    const goldPerMinute =
      extractNumericFromConfigValue(rawGoldConfig, {
        levelId: cultivation.current_level_id,
        preferredKeys: [
          'gold_per_minute',
          'base_gold_per_minute',
          'gold',
        ],
      }) ?? 0;

    const levelAfkStats = await getUserLevelAfkStats(userId, conn);
    const useLevelMultiplier = extractBooleanFromConfigValue(
      configMap.afk_use_level_multiplier ?? true,
      true
    );
    const levelMultiplier = useLevelMultiplier
      ? Number(levelAfkStats.afk_multiplier || 1)
      : 1;
    const finalExpPerMinute = Number(
      (Number(levelAfkStats.afk_exp_per_min || expPerMinute) || expPerMinute) *
        (levelAfkStats.afk_exp_per_min ? 1 : levelMultiplier)
    );
    const finalGoldPerMinute = Number(
      (Number(levelAfkStats.afk_gold_per_min || goldPerMinute) || goldPerMinute) *
        (levelAfkStats.afk_gold_per_min ? 1 : levelMultiplier)
    );

    const commonBonusPercent =
      extractNumericFromConfigValue(rawCommonBonusConfig, {
        levelId: cultivation.current_level_id,
        preferredKeys: [
          'bonus_percent',
          'afk_bonus_percent',
          'percent',
        ],
      }) ?? 0;

    const vipBonusPercent = await getUserVipBonusPercent(
      userId,
      conn,
      configMap
    );

    const totalBonusPercent = commonBonusPercent + vipBonusPercent;

    const rewardableMinutes = rewardableSeconds / 60;

    const baseExp = Math.floor(rewardableMinutes * finalExpPerMinute);
    const bonusExp = Math.floor((baseExp * totalBonusPercent) / 100);
    const totalExp = baseExp + bonusExp;

    const baseGold = Number((rewardableMinutes * finalGoldPerMinute).toFixed(2));
    const bonusGold = Number(
      ((baseGold * totalBonusPercent) / 100).toFixed(2)
    );
    const totalGold = Number((baseGold + bonusGold).toFixed(2));

    await conn.query(
      `
      UPDATE afk_sessions
      SET ended_at = NOW(),
          duration_seconds = :actualDurationSeconds,
          base_exp_earned = :baseExp,
          bonus_exp_earned = :bonusExp,
          total_exp_earned = :totalExp,
          base_gold_earned = :baseGold,
          bonus_gold_earned = :bonusGold,
          total_gold_earned = :totalGold,
          session_status = 'finished',
          updated_at = NOW()
      WHERE id = :sessionId
      `,
      {
        actualDurationSeconds,
        baseExp,
        bonusExp,
        totalExp,
        baseGold,
        bonusGold,
        totalGold,
        sessionId,
      }
    );

    const updatedRows = await queryWithConn(
      conn,
      `
      SELECT *
      FROM afk_sessions
      WHERE id = :sessionId
      LIMIT 1
      `,
      { sessionId }
    );

    return updatedRows[0];
  });
}

async function claimSession(userId, sessionId) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  return transaction(async (conn) => {
    const rows = await queryWithConn(
      conn,
      `
      SELECT *
      FROM afk_sessions
      WHERE id = :sessionId
        AND user_id = :userId
      LIMIT 1
      `,
      { sessionId, userId }
    );

    if (!rows.length) {
      throw new ApiError(404, 'Không tìm thấy phiên AFK');
    }

    const session = rows[0];

    if (session.session_status !== 'finished') {
      throw new ApiError(400, 'Phiên AFK chưa thể nhận thưởng');
    }

    if (session.claim_status === 'claimed') {
      throw new ApiError(400, 'Phiên AFK đã được nhận thưởng trước đó');
    }

    const configMap = await getAfkConfigMap();

    const minMinutesToClaim =
      extractNumericFromConfigValue(
        configMap.afk_min_minutes_to_claim ?? 0,
        {
          preferredKeys: [
            'min_minutes_to_claim',
            'afk_min_minutes_to_claim',
            'minutes',
          ],
        }
      ) ?? 0;

    const requiredSeconds = Math.max(0, Math.floor(minMinutesToClaim * 60));

    if (requiredSeconds > 0 && Number(session.duration_seconds || 0) < requiredSeconds) {
      throw new ApiError(
        400,
        `Cần AFK tối thiểu ${minMinutesToClaim} phút để nhận thưởng`
      );
    }

    const cultivation = await getUserCultivation(userId, conn);

    if (!cultivation) {
      throw new ApiError(404, 'Không tìm thấy dữ liệu tu luyện của người dùng');
    }

    const claimedExp = Number(session.total_exp_earned || 0);
    const claimedGold = Number(session.total_gold_earned || 0);

    await cultivationService.addExpToUser(userId, claimedExp, conn);

    await ensureUserProfileRewardRow(userId, claimedGold, conn);

    await conn.query(
      `
      UPDATE afk_sessions
      SET claim_status = 'claimed',
          updated_at = NOW()
      WHERE id = :sessionId
      `,
      { sessionId }
    );

    await conn.query(
      `
      INSERT INTO afk_claim_logs (
        afk_session_id,
        user_id,
        claimed_exp,
        claimed_gold,
        claimed_at,
        note
      )
      VALUES (
        :sessionId,
        :userId,
        :claimedExp,
        :claimedGold,
        NOW(),
        'Claim AFK reward'
      )
      `,
      {
        sessionId,
        userId,
        claimedExp,
        claimedGold,
      }
    );

    return {
      claimedExp,
      claimedGold,
    };
  });
}

module.exports = {
  listConfigs,
  getRunningSession,
  startSession,
  finishSession,
  claimSession,
};