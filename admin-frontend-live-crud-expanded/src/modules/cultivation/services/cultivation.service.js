const { query, queryWithConn, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value) {
  return value === true || value === 1 || value === '1' || String(value).toUpperCase() === 'YES';
}

async function getLevelById(levelId, conn = null) {
  const sql = `
    SELECT l.*, r.name AS realm_name, r.realm_order
    FROM levels l
    LEFT JOIN realms r ON r.id = l.realm_id
    WHERE l.id = :levelId
    LIMIT 1
  `;
  const rows = conn ? await queryWithConn(conn, sql, { levelId }) : await query(sql, { levelId });
  return rows[0] || null;
}

async function getLevelByNumber(levelNumber, conn = null) {
  const sql = `
    SELECT l.*, r.name AS realm_name, r.realm_order
    FROM levels l
    LEFT JOIN realms r ON r.id = l.realm_id
    WHERE l.level_number = :levelNumber
    LIMIT 1
  `;
  const rows = conn ? await queryWithConn(conn, sql, { levelNumber }) : await query(sql, { levelNumber });
  return rows[0] || null;
}

async function getUserCultivation(userId, conn = null) {
  const sql = `
    SELECT uc.*, l.level_number, l.exp_required, l.stage_number, l.stage_band, l.stage_name,
           l.power_points, l.afk_multiplier, l.afk_exp_per_min, l.afk_gold_per_min,
           l.is_breakthrough_level, l.breakthrough_to_realm_id,
           r.name AS realm_name, r.realm_order
    FROM user_cultivation uc
    LEFT JOIN levels l ON l.id = uc.current_level_id
    LEFT JOIN realms r ON r.id = uc.current_realm_id
    WHERE uc.user_id = :userId
    LIMIT 1
  `;
  const rows = conn ? await queryWithConn(conn, sql, { userId }) : await query(sql, { userId });
  return rows[0] || null;
}

async function ensureUserCultivation(userId, conn = null) {
  let row = await getUserCultivation(userId, conn);
  if (row) return row;

  const sql = `
    INSERT INTO user_cultivation (
      user_id, current_level_id, current_realm_id, current_exp, total_exp_earned,
      breakthrough_count, spirit_stones, reputation_points, combat_power, created_at, updated_at
    ) VALUES (:userId, 1, 1, 0, 0, 0, 0, 0, 100, NOW(), NOW())
  `;
  if (conn) await conn.query(sql, { userId }); else await query(sql, { userId });
  row = await getUserCultivation(userId, conn);
  return row;
}

async function listRealms() {
  return query(`
    SELECT id, name, realm_order, description, base_power_bonus, created_at, updated_at
    FROM realms
    ORDER BY realm_order ASC
  `);
}

async function listLevels() {
  return query(`
    SELECT l.*, r.name AS realm_name, tr.name AS breakthrough_to_realm_name
    FROM levels l
    LEFT JOIN realms r ON r.id = l.realm_id
    LEFT JOIN realms tr ON tr.id = l.breakthrough_to_realm_id
    ORDER BY l.level_number ASC
  `);
}

async function listBreakthroughRules() {
  return query(`
    SELECT br.*, fr.name AS from_realm_name, tr.name AS to_realm_name,
           req.name AS required_item_name, req.code AS required_item_code,
           ins.name AS insurance_item_name, ins.code AS insurance_item_code
    FROM cultivation_breakthrough_rules br
    LEFT JOIN realms fr ON fr.id = br.from_realm_id
    LEFT JOIN realms tr ON tr.id = br.to_realm_id
    LEFT JOIN items req ON req.id = br.required_item_id
    LEFT JOIN items ins ON ins.id = br.insurance_item_id
    ORDER BY br.breakthrough_level ASC, br.required_level_number ASC
  `);
}

async function getCurrentBreakthroughRule(userId, conn = null) {
  const cultivation = await ensureUserCultivation(userId, conn);
  const levelNumber = Number(cultivation.level_number || 1);
  const rows = conn
    ? await queryWithConn(conn, `
        SELECT br.*, req.name AS required_item_name, req.code AS required_item_code,
               ins.name AS insurance_item_name, ins.code AS insurance_item_code,
               tr.name AS to_realm_name
        FROM cultivation_breakthrough_rules br
        LEFT JOIN items req ON req.id = br.required_item_id
        LEFT JOIN items ins ON ins.id = br.insurance_item_id
        LEFT JOIN realms tr ON tr.id = br.to_realm_id
        WHERE br.breakthrough_level = :levelNumber
        LIMIT 1
      `, { levelNumber })
    : await query(`
        SELECT br.*, req.name AS required_item_name, req.code AS required_item_code,
               ins.name AS insurance_item_name, ins.code AS insurance_item_code,
               tr.name AS to_realm_name
        FROM cultivation_breakthrough_rules br
        LEFT JOIN items req ON req.id = br.required_item_id
        LEFT JOIN items ins ON ins.id = br.insurance_item_id
        LEFT JOIN realms tr ON tr.id = br.to_realm_id
        WHERE br.breakthrough_level = :levelNumber
        LIMIT 1
      `, { levelNumber });
  return rows[0] || null;
}

async function getInventoryQuantity(userId, itemId, conn) {
  if (!itemId) return 0;
  const rows = await queryWithConn(conn, `
    SELECT COALESCE(SUM(quantity),0) AS quantity
    FROM user_inventory
    WHERE user_id = :userId AND item_id = :itemId
  `, { userId, itemId });
  return Number(rows[0]?.quantity || 0);
}

async function consumeInventoryItem(conn, userId, itemId, quantity, sourceNote) {
  if (!itemId || quantity <= 0) return;
  const owned = await getInventoryQuantity(userId, itemId, conn);
  if (owned < quantity) throw new ApiError(400, `Không đủ vật phẩm để ${sourceNote}`);

  let remaining = quantity;
  const rows = await queryWithConn(conn, `
    SELECT id, quantity
    FROM user_inventory
    WHERE user_id = :userId AND item_id = :itemId AND quantity > 0
    ORDER BY id ASC
  `, { userId, itemId });

  for (const row of rows) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(row.quantity || 0));
    await conn.query(`UPDATE user_inventory SET quantity = quantity - :take, updated_at = NOW() WHERE id = :id`, { take, id: row.id });
    remaining -= take;
  }
}

async function getAttemptRow(userId, breakthroughLevel, conn) {
  const rows = await queryWithConn(conn, `
    SELECT *
    FROM cultivation_breakthrough_attempts
    WHERE user_id = :userId AND breakthrough_level = :breakthroughLevel
    LIMIT 1
  `, { userId, breakthroughLevel });
  return rows[0] || null;
}

async function normalizeCultivationProgress(userId, conn = null) {
  const run = async (db) => {
    let cultivation = await ensureUserCultivation(userId, db);
    let level = await getLevelById(cultivation.current_level_id, db);
    if (!level) return cultivation;

    let currentExp = Math.max(0, Math.floor(Number(cultivation.current_exp || 0)));
    let currentLevelId = Number(cultivation.current_level_id || level.id || 1);
    let currentRealmId = Number(cultivation.current_realm_id || level.realm_id || 1);
    let combatPower = Number(cultivation.combat_power || 0);

    while (level && currentExp >= Number(level.exp_required || 0)) {
      const levelNumber = Number(level.level_number || 1);
      const requiredExp = Number(level.exp_required || 0);

      if (requiredExp <= 0) break;

      // Tầng 10 của mỗi cảnh giới là mốc đột phá.
      // Khi đủ EXP ở tầng này, giữ đầy thanh EXP và chờ người chơi bấm đột phá,
      // không tự nhảy sang cảnh giới kế tiếp.
      if (Number(level.is_breakthrough_level || 0) === 1) {
        currentExp = Math.min(currentExp, requiredExp);
        currentLevelId = Number(level.id);
        currentRealmId = Number(level.realm_id || currentRealmId);
        combatPower = Math.max(combatPower, Number(level.power_points || combatPower));
        break;
      }

      // Cảnh giới cuối / cấp cuối: chỉ cho đầy thanh, không vượt vô hạn.
      if (levelNumber >= 200) {
        currentExp = Math.min(currentExp, requiredExp);
        currentLevelId = Number(level.id);
        currentRealmId = Number(level.realm_id || currentRealmId);
        combatPower = Math.max(combatPower, Number(level.power_points || combatPower));
        break;
      }

      // Tầng 1-9: đủ EXP thì tự lên tầng kế tiếp, phần EXP dư được carry over.
      currentExp -= requiredExp;
      const nextLevel = await getLevelByNumber(levelNumber + 1, db);
      if (!nextLevel) {
        currentExp = Math.min(currentExp, requiredExp);
        break;
      }

      level = nextLevel;
      currentLevelId = Number(level.id);
      currentRealmId = Number(level.realm_id || currentRealmId);
      combatPower = Math.max(combatPower, Number(level.power_points || combatPower));
    }

    await db.query(`
      UPDATE user_cultivation
      SET current_exp = :currentExp,
          current_level_id = :currentLevelId,
          current_realm_id = :currentRealmId,
          combat_power = :combatPower,
          updated_at = NOW()
      WHERE user_id = :userId
    `, { currentExp, currentLevelId, currentRealmId, combatPower, userId });

    return getUserCultivation(userId, db);
  };

  if (conn) return run(conn);
  return transaction(run);
}

async function addExpToUser(userId, expAmount, conn = null) {
  const gained = Math.max(0, Math.floor(Number(expAmount || 0)));

  const run = async (db) => {
    await ensureUserCultivation(userId, db);

    if (gained > 0) {
      await db.query(`
        UPDATE user_cultivation
        SET current_exp = current_exp + :gained,
            total_exp_earned = total_exp_earned + :gained,
            updated_at = NOW()
        WHERE user_id = :userId
      `, { gained, userId });
    }

    return normalizeCultivationProgress(userId, db);
  };

  if (conn) return run(conn);
  return transaction(run);
}

async function getMyCultivation(userId) {
  await normalizeCultivationProgress(userId);

  const [cultivation, realms, levels, rules] = await Promise.all([
    getUserCultivation(userId),
    listRealms(),
    listLevels(),
    listBreakthroughRules(),
  ]);

  const rule = await getCurrentBreakthroughRule(userId);
  let failCount = 0;
  let currentRate = null;

  if (rule) {
    const attemptRows = await query(`
      SELECT fail_count
      FROM cultivation_breakthrough_attempts
      WHERE user_id = :userId AND breakthrough_level = :level
      LIMIT 1
    `, { userId, level: rule.breakthrough_level });
    failCount = Number(attemptRows[0]?.fail_count || 0);
    currentRate = Math.min(100, Number(rule.success_rate_percent || 0) + failCount * Number(rule.fail_bonus_per_fail || 0) * 100);
  }

  return {
    cultivation,
    currentRule: rule ? { ...rule, fail_count: failCount, current_success_rate_percent: currentRate } : null,
    realms,
    levels,
    breakthroughRules: rules,
  };
}

async function attemptBreakthrough(userId, useInsurance = false) {
  return transaction(async (conn) => {
    const cultivation = await ensureUserCultivation(userId, conn);
    const level = await getLevelById(cultivation.current_level_id, conn);
    if (!level || Number(level.is_breakthrough_level || 0) !== 1) {
      throw new ApiError(400, 'Hiện tại chưa tới mốc đột phá cảnh giới');
    }

    const rule = await getCurrentBreakthroughRule(userId, conn);
    if (!rule) throw new ApiError(400, 'Không tìm thấy luật đột phá cho cấp hiện tại');

    const requiredExp = Number(level.exp_required || 0);
    if (Number(cultivation.current_exp || 0) < requiredExp) {
      throw new ApiError(400, `Cần đủ ${requiredExp} EXP ở cấp hiện tại để đột phá`);
    }

    if (Number(rule.required_item_id || 0) > 0 && Number(rule.required_item_quantity || 0) > 0) {
      const quantity = await getInventoryQuantity(userId, rule.required_item_id, conn);
      if (quantity < Number(rule.required_item_quantity)) {
        throw new ApiError(400, `Không đủ ${rule.required_item_name || 'vật phẩm đột phá'}`);
      }
    }

    if (useInsurance && Number(rule.insurance_item_id || 0) > 0 && Number(rule.insurance_item_quantity || 0) > 0) {
      const quantity = await getInventoryQuantity(userId, rule.insurance_item_id, conn);
      if (quantity < Number(rule.insurance_item_quantity)) {
        throw new ApiError(400, `Không đủ ${rule.insurance_item_name || 'vật phẩm bảo hiểm'}`);
      }
    }

    await consumeInventoryItem(conn, userId, rule.required_item_id, Number(rule.required_item_quantity || 0), 'đột phá');
    if (useInsurance) {
      await consumeInventoryItem(conn, userId, rule.insurance_item_id, Number(rule.insurance_item_quantity || 0), 'bảo hiểm đột phá');
    }

    const attempt = await getAttemptRow(userId, rule.breakthrough_level, conn);
    const failCount = Number(attempt?.fail_count || 0);
    const currentRatePercent = Math.min(100, Number(rule.success_rate_percent || 0) + failCount * Number(rule.fail_bonus_per_fail || 0) * 100);
    const roll = Math.random() * 100;
    const success = roll <= currentRatePercent;

    if (success) {
      const nextLevel = await getLevelByNumber(Number(level.level_number) + 1, conn);
      if (!nextLevel) throw new ApiError(400, 'Không tìm thấy cấp tiếp theo');
      const nextExp = Math.max(0, Number(cultivation.current_exp || 0) - requiredExp);
      await conn.query(`
        UPDATE user_cultivation
        SET current_level_id = :levelId,
            current_realm_id = :realmId,
            current_exp = :currentExp,
            breakthrough_count = breakthrough_count + 1,
            combat_power = :combatPower,
            last_breakthrough_at = NOW(),
            updated_at = NOW()
        WHERE user_id = :userId
      `, {
        levelId: nextLevel.id,
        realmId: nextLevel.realm_id,
        currentExp: nextExp,
        combatPower: Number(nextLevel.power_points || cultivation.combat_power || 0),
        userId,
      });
      await conn.query(`DELETE FROM cultivation_breakthrough_attempts WHERE user_id = :userId AND breakthrough_level = :level`, { userId, level: rule.breakthrough_level });
      return { success: true, roll, success_rate_percent: currentRatePercent, cultivation: await getUserCultivation(userId, conn) };
    }

    let targetLevel = level;
    let nextCurrentExp = Number(cultivation.current_exp || 0);

    if (useInsurance) {
      const lossPercent = Number(rule.insurance_exp_loss_percent || 0.5);
      nextCurrentExp = Math.max(0, Math.floor(nextCurrentExp * (1 - lossPercent)));
    } else if (Number(rule.fail_return_level || level.level_number) < Number(level.level_number)) {
      targetLevel = await getLevelByNumber(Number(rule.fail_return_level), conn) || level;
      nextCurrentExp = 0;
    }

    await conn.query(`
      INSERT INTO cultivation_breakthrough_attempts (user_id, breakthrough_level, fail_count, last_attempt_at, created_at, updated_at)
      VALUES (:userId, :breakthroughLevel, 1, NOW(), NOW(), NOW())
      ON DUPLICATE KEY UPDATE fail_count = fail_count + 1, last_attempt_at = NOW(), updated_at = NOW()
    `, { userId, breakthroughLevel: rule.breakthrough_level });

    await conn.query(`
      UPDATE user_cultivation
      SET current_level_id = :levelId,
          current_realm_id = :realmId,
          current_exp = :currentExp,
          combat_power = :combatPower,
          updated_at = NOW()
      WHERE user_id = :userId
    `, {
      levelId: targetLevel.id,
      realmId: targetLevel.realm_id,
      currentExp: nextCurrentExp,
      combatPower: Number(targetLevel.power_points || cultivation.combat_power || 0),
      userId,
    });

    return {
      success: false,
      roll,
      success_rate_percent: currentRatePercent,
      fail_bonus_next_percent: Math.min(100, currentRatePercent + Number(rule.fail_bonus_per_fail || 0) * 100),
      use_insurance: Boolean(useInsurance),
      cultivation: await getUserCultivation(userId, conn),
    };
  });
}

module.exports = {
  listRealms,
  listLevels,
  listBreakthroughRules,
  getMyCultivation,
  attemptBreakthrough,
  addExpToUser,
  normalizeCultivationProgress,
  getUserCultivation,
  ensureUserCultivation,
};
