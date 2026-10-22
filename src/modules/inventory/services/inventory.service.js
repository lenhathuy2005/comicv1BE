const { query } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

async function getMyInventory(userId) {
  const rows = await query(
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
      it.code AS item_type_code,
      it.name AS item_type_name
    FROM user_inventory ui
    INNER JOIN items i ON i.id = ui.item_id
    LEFT JOIN item_types it ON it.id = i.item_type_id
    WHERE ui.user_id = :userId
    ORDER BY ui.id DESC
    `,
    { userId }
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      item_id: row.item_id,
      quantity: row.quantity,
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
      },
    })),
  };
}

async function useItem({ userId, itemId, quantity }) {
  if (!itemId || Number.isNaN(Number(itemId))) {
    throw new ApiError(400, 'Thiếu hoặc sai item_id');
  }

  quantity = Number(quantity || 1);
  if (Number.isNaN(quantity) || quantity <= 0) {
    throw new ApiError(400, 'quantity không hợp lệ');
  }

  const itemRows = await query(
    `
    SELECT id, code, name
    FROM items
    WHERE id = :itemId
    LIMIT 1
    `,
    { itemId }
  );

  if (!itemRows.length) {
    throw new ApiError(404, 'Không tìm thấy item');
  }

  const inventoryRows = await query(
    `
    SELECT *
    FROM user_inventory
    WHERE user_id = :userId
      AND item_id = :itemId
    LIMIT 1
    `,
    { userId, itemId }
  );

  if (!inventoryRows.length) {
    throw new ApiError(404, 'Bạn không có item này');
  }

  const userItem = inventoryRows[0];

  if (Number(userItem.quantity) < quantity) {
    throw new ApiError(400, 'Không đủ số lượng item');
  }

  const remainingQuantity = Number(userItem.quantity) - quantity;

  if (remainingQuantity > 0) {
    await query(
      `
      UPDATE user_inventory
      SET quantity = :remainingQuantity,
          updated_at = NOW()
      WHERE id = :id
      `,
      {
        remainingQuantity,
        id: userItem.id,
      }
    );
  } else {
    await query(
      `
      DELETE FROM user_inventory
      WHERE id = :id
      `,
      { id: userItem.id }
    );
  }

  await query(
    `
    INSERT INTO item_transactions (
      user_id,
      item_id,
      transaction_type,
      quantity,
      unit_price_gold,
      unit_price_premium,
      total_price_gold,
      total_price_premium,
      note,
      created_by_user_id,
      created_at
    )
    VALUES (
      :userId,
      :itemId,
      'use_item',
      :quantity,
      0,
      0,
      0,
      0,
      :note,
      NULL,
      NOW()
    )
    `,
    {
      userId,
      itemId,
      quantity,
      note: `User dùng item ${itemRows[0].name}`,
    }
  );

  return {
    item_id: Number(itemId),
    item_name: itemRows[0].name,
    used_quantity: quantity,
    remaining_quantity: remainingQuantity,
  };
}

module.exports = {
  getMyInventory,
  useItem,
};