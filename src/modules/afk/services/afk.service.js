const { query, queryWithConn, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

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
      return rawValue === true || rawValue === 'true' || rawValue === '1' || rawValue === 1;
    case 'json':
      try {
        return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
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

  const commonKeys = ['value', 'default', 'base', 'amount', 'exp_per_minute', 'percent'];
  for (const key of commonKeys) {
    if (configValue[key] !== undefined) {
      const byKey = tryNumber(configValue[key]);
      if (byKey !== null) return byKey;
    }
  }

  return null;
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

  return rows.map((row) => ({
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
      AND session_status = 'running'
    LIMIT 1
    `,
    { userId }
  );

  return rows[0] || null;
}

async function getAfkConfigMap() {
  const rows = await query(`
    SELECT config_key, config_value, value_type
    FROM afk_configs
  `);

  const map = {};
  for (const row of rows) {
    map[row.config_key] = parseConfigValue(row.config_value, row.value_type);
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

async function startSession(userId) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
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
      `SELECT * FROM afk_sessions WHERE id = :id LIMIT 1`,
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
      throw new ApiError(400, 'Phiên AFK này không còn ở trạng thái running');
    }

    const cultivation = await getUserCultivation(userId, conn);
    if (!cultivation) {
      throw new ApiError(404, 'Không tìm thấy dữ liệu tu luyện của người dùng');
    }

    const endedAt = new Date();
    const durationSeconds = calculateDurationSeconds(session.started_at, endedAt);
    const configMap = await getAfkConfigMap();

    const rawExpConfig =
      configMap.afk_base_exp_per_minute ??
      configMap.afk_exp_per_minute ??
      configMap.base_exp_per_minute ??
      10;

    const rawBonusConfig =
      configMap.afk_bonus_percent ??
      0;

    const expPerMinute =
      extractNumericFromConfigValue(rawExpConfig, {
        levelId: cultivation.current_level_id,
        preferredKeys: ['exp_per_minute', 'base_exp_per_minute'],
      }) ?? 10;

    const bonusPercent =
      extractNumericFromConfigValue(rawBonusConfig, {
        levelId: cultivation.current_level_id,
        preferredKeys: ['bonus_percent', 'afk_bonus_percent', 'percent'],
      }) ?? 0;

    const baseExp = Math.floor((durationSeconds / 60) * expPerMinute);
    const bonusExp = Math.floor((baseExp * bonusPercent) / 100);
    const totalExp = baseExp + bonusExp;

    await conn.query(
      `
      UPDATE afk_sessions
      SET ended_at = NOW(),
          duration_seconds = :durationSeconds,
          base_exp_earned = :baseExp,
          bonus_exp_earned = :bonusExp,
          total_exp_earned = :totalExp,
          session_status = 'finished',
          updated_at = NOW()
      WHERE id = :sessionId
      `,
      {
        durationSeconds,
        baseExp,
        bonusExp,
        totalExp,
        sessionId,
      }
    );

    const updatedRows = await queryWithConn(
      conn,
      `SELECT * FROM afk_sessions WHERE id = :sessionId LIMIT 1`,
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

    const cultivation = await getUserCultivation(userId, conn);
    if (!cultivation) {
      throw new ApiError(404, 'Không tìm thấy dữ liệu tu luyện của người dùng');
    }

    const claimedExp = Number(session.total_exp_earned || 0);
    const claimedGold = 0;

    await conn.query(
      `
      UPDATE user_cultivation
      SET current_exp = current_exp + :claimedExp,
          total_exp_earned = total_exp_earned + :claimedExp,
          updated_at = NOW()
      WHERE user_id = :userId
      `,
      {
        claimedExp,
        userId,
      }
    );

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