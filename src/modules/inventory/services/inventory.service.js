const { transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

function mapInventoryRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    item_id: row.item_id,
    quantity: Number(row.quantity || 0),
    is_bound: Number(row.is_bound) === 1,
    obtained_from: row.obtained_from,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    item: {
      id: row.item_id,
      code: row.code,
      name: row.name,
      description: row.description,
      item_type_id: row.item_type_id,
      item_type_code: row.item_type_code,
      item_type_name: row.item_type_name,
      icon_url: row.icon_url,
      rarity: row.rarity,
      usable_instantly: Boolean(Number(row.usable_instantly || 0)),
      equippable: Boolean(Number(row.equippable || 0)),
      exp_bonus: Number(row.exp_bonus || 0),
      power_bonus: Number(row.power_bonus || 0),
      afk_bonus_percent: Number(row.afk_bonus_percent || 0),
      vip_required_level: Number(row.vip_required_level || 0),
    },
  }));
}

async function loadInventory(conn, userId) {
  const [rows] = await conn.execute(
    `
    SELECT
      ui.id,
      ui.user_id,
      ui.item_id,
      ui.quantity,
      ui.is_bound,
      ui.obtained_from,
      ui.expires_at,
      ui.created_at,
      ui.updated_at,
      i.code,
      i.name,
      i.description,
      i.item_type_id,
      i.icon_url,
      i.rarity,
      i.usable_instantly,
      i.equippable,
      i.exp_bonus,
      i.power_bonus,
      i.afk_bonus_percent,
      i.vip_required_level,
      it.code AS item_type_code,
      it.name AS item_type_name
    FROM user_inventory ui
    INNER JOIN items i ON i.id = ui.item_id
    LEFT JOIN item_types it ON it.id = i.item_type_id
    WHERE ui.user_id = ?
    ORDER BY ui.id DESC
    `,
    [userId]
  );
  return rows;
}

async function getMyInventory(userId) {
  return transaction(async (conn) => {
    const rows = await loadInventory(conn, userId);
    const [resourceRows] = await conn.execute(
      `SELECT up.gold_balance, up.premium_currency, up.energy, up.stamina, up.power_score,
              uc.current_exp, uc.total_exp_earned, uc.spirit_stones, uc.combat_power,
              uv.current_vip_level_id
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN user_cultivation uc ON uc.user_id = u.id
       LEFT JOIN user_vip uv ON uv.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );

    const resource = resourceRows[0] || {};
    const mapped = mapInventoryRows(rows);
    return {
      summary: {
        distinct_item_count: mapped.length,
        total_quantity: mapped.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        gold_balance: Number(resource.gold_balance || 0),
        premium_currency: Number(resource.premium_currency || 0),
        current_exp: Number(resource.current_exp || 0),
        total_exp_earned: Number(resource.total_exp_earned || 0),
        spirit_stones: Number(resource.spirit_stones || 0),
        combat_power: Number(resource.combat_power || 0),
        power_score: Number(resource.power_score || 0),
        vip_level_id: Number(resource.current_vip_level_id || 0),
      },
      items: mapped,
    };
  });
}

async function useItem({ userId, itemId, quantity }) {
  if (!itemId || Number.isNaN(Number(itemId))) {
    throw new ApiError(400, 'Thiếu hoặc sai item_id');
  }

  quantity = Number(quantity || 1);
  if (Number.isNaN(quantity) || quantity <= 0) {
    throw new ApiError(400, 'quantity không hợp lệ');
  }

  return transaction(async (conn) => {
    const [itemRows] = await conn.execute(
      `
      SELECT i.*, uv.current_vip_level_id
      FROM items i
      LEFT JOIN user_vip uv ON uv.user_id = ?
      WHERE i.id = ?
      LIMIT 1
      `,
      [userId, itemId]
    );

    if (!itemRows.length) {
      throw new ApiError(404, 'Không tìm thấy item');
    }

    const item = itemRows[0];
    const vipLevel = Number(item.current_vip_level_id || 0);

    if (!Number(item.is_active)) throw new ApiError(400, 'Item đang bị khóa');
    if (!Number(item.usable_instantly)) throw new ApiError(400, 'Item này chưa hỗ trợ dùng trực tiếp');
    if (Number(item.vip_required_level || 0) > vipLevel) {
      throw new ApiError(403, `Cần VIP ${item.vip_required_level} để dùng item này`);
    }

    const [inventoryRows] = await conn.execute(
      `SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ? LIMIT 1`,
      [userId, itemId]
    );

    if (!inventoryRows.length) throw new ApiError(404, 'Bạn không có item này');
    const userItem = inventoryRows[0];
    if (Number(userItem.quantity) < quantity) throw new ApiError(400, 'Không đủ số lượng item');

    const expGain = Number(item.exp_bonus || 0) * quantity;
    const powerGain = Number(item.power_bonus || 0) * quantity;
    const afkBonusGain = Number(item.afk_bonus_percent || 0) * quantity;
    const spiritStoneGain = item.code === 'LINH_THACH' ? quantity : 0;

    const remainingQuantity = Number(userItem.quantity) - quantity;

    if (remainingQuantity > 0) {
      await conn.execute(`UPDATE user_inventory SET quantity = ?, updated_at = NOW() WHERE id = ?`, [remainingQuantity, userItem.id]);
    } else {
      await conn.execute(`DELETE FROM user_inventory WHERE id = ?`, [userItem.id]);
    }

    if (expGain || powerGain || spiritStoneGain || afkBonusGain) {
      await conn.execute(
        `UPDATE user_cultivation
         SET current_exp = COALESCE(current_exp, 0) + ?,
             total_exp_earned = COALESCE(total_exp_earned, 0) + ?,
             combat_power = COALESCE(combat_power, 0) + ?,
             spirit_stones = COALESCE(spirit_stones, 0) + ?,
             updated_at = NOW()
         WHERE user_id = ?`,
        [expGain, expGain, powerGain, spiritStoneGain, userId]
      );

      await conn.execute(
        `UPDATE user_profiles
         SET power_score = COALESCE(power_score, 0) + ?,
             updated_at = NOW()
         WHERE user_id = ?`,
        [powerGain, userId]
      );
    }

    await conn.execute(
      `INSERT INTO item_transactions (
        user_id, item_id, transaction_type, quantity,
        unit_price_gold, unit_price_premium, total_price_gold, total_price_premium,
        note, created_by_user_id, created_at
      ) VALUES (?, ?, 'use_item', ?, 0, 0, 0, 0, ?, NULL, NOW())`,
      [userId, itemId, quantity, `User dùng item ${item.name}`]
    );

    const inventory = await loadInventory(conn, userId);

    return {
      item_id: Number(itemId),
      item_name: item.name,
      used_quantity: quantity,
      remaining_quantity: remainingQuantity,
      applied_effects: {
        exp_gain: expGain,
        power_gain: powerGain,
        afk_bonus_percent_gain: Number(afkBonusGain.toFixed(2)),
        spirit_stone_gain: spiritStoneGain,
      },
      inventory: {
        items: mapInventoryRows(inventory),
      },
    };
  });
}

module.exports = {
  getMyInventory,
  useItem,
};
