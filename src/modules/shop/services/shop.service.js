const { query, queryWithConn, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

function normalizeBoolean(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === true || value === 'true' || value === 1 || value === '1') return 1;
  return 0;
}

function normalizeNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function normalizeRequiredNumber(value, fieldName) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new ApiError(400, `${fieldName} không hợp lệ`);
  }
  return parsed;
}

// =========================
// USER-FACING
// =========================

async function listShopItems() {
  const sql = `
    SELECT
      si.id,
      si.item_id,
      si.price_gold,
      si.price_premium,
      si.stock_quantity,
      si.daily_purchase_limit,
      si.vip_required_level,
      si.start_at,
      si.end_at,
      si.is_active,
      i.code AS item_code,
      i.name AS item_name,
      i.description,
      i.icon_url,
      i.rarity,
      i.is_stackable,
      i.max_stack,
      i.usable_instantly,
      i.equippable
    FROM shop_items si
    INNER JOIN items i ON i.id = si.item_id
    WHERE si.is_active = 1
      AND (si.start_at IS NULL OR si.start_at <= NOW())
      AND (si.end_at IS NULL OR si.end_at >= NOW())
      AND i.is_active = 1
    ORDER BY si.id ASC
  `;

  return query(sql);
}

async function buyItem({ userId, shopItemId, quantity = 1 }) {
  if (!userId) {
    throw new ApiError(401, 'Không xác định được người dùng hiện tại');
  }

  if (!quantity || Number(quantity) <= 0) {
    throw new ApiError(400, 'Số lượng mua không hợp lệ');
  }

  quantity = Number(quantity);

  return transaction(async (conn) => {
    const shopRows = await queryWithConn(
      conn,
      `
      SELECT
        si.*,
        i.id AS item_id,
        i.name AS item_name,
        i.is_stackable,
        i.max_stack
      FROM shop_items si
      INNER JOIN items i ON i.id = si.item_id
      WHERE si.id = :shopItemId
        AND si.is_active = 1
        AND (si.start_at IS NULL OR si.start_at <= NOW())
        AND (si.end_at IS NULL OR si.end_at >= NOW())
      LIMIT 1
      `,
      { shopItemId }
    );

    if (!shopRows.length) {
      throw new ApiError(404, 'Không tìm thấy vật phẩm trong shop');
    }

    const shopItem = shopRows[0];

    if (shopItem.stock_quantity !== null && Number(shopItem.stock_quantity) < quantity) {
      throw new ApiError(400, 'Số lượng tồn kho không đủ');
    }

    const profileRows = await queryWithConn(
      conn,
      `
      SELECT id, user_id, gold_balance, premium_currency
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
    const totalGold = Number(shopItem.price_gold || 0) * quantity;
    const totalPremium = Number(shopItem.price_premium || 0) * quantity;

    if (Number(profile.gold_balance) < totalGold) {
      throw new ApiError(400, 'Không đủ vàng');
    }

    if (Number(profile.premium_currency) < totalPremium) {
      throw new ApiError(400, 'Không đủ premium currency');
    }

    await conn.query(
      `
      UPDATE user_profiles
      SET gold_balance = gold_balance - :totalGold,
          premium_currency = premium_currency - :totalPremium,
          updated_at = NOW()
      WHERE user_id = :userId
      `,
      { totalGold, totalPremium, userId }
    );

    const inventoryRows = await queryWithConn(
      conn,
      `
      SELECT id, quantity
      FROM user_inventory
      WHERE user_id = :userId
        AND item_id = :itemId
        AND is_bound = 0
      LIMIT 1
      `,
      {
        userId,
        itemId: shopItem.item_id,
      }
    );

    if (inventoryRows.length) {
      await conn.query(
        `
        UPDATE user_inventory
        SET quantity = quantity + :quantity,
            updated_at = NOW()
        WHERE id = :inventoryId
        `,
        {
          quantity,
          inventoryId: inventoryRows[0].id,
        }
      );
    } else {
      await conn.query(
        `
        INSERT INTO user_inventory (
          user_id,
          item_id,
          quantity,
          is_bound,
          obtained_from,
          created_at,
          updated_at
        )
        VALUES (
          :userId,
          :itemId,
          :quantity,
          0,
          'buy_from_shop',
          NOW(),
          NOW()
        )
        `,
        {
          userId,
          itemId: shopItem.item_id,
          quantity,
        }
      );
    }

    if (shopItem.stock_quantity !== null) {
      await conn.query(
        `
        UPDATE shop_items
        SET stock_quantity = stock_quantity - :quantity,
            updated_at = NOW()
        WHERE id = :shopItemId
        `,
        { quantity, shopItemId }
      );
    }

    await conn.query(
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
        created_at
      )
      VALUES (
        :userId,
        :itemId,
        'buy_from_shop',
        :quantity,
        :unitPriceGold,
        :unitPricePremium,
        :totalGold,
        :totalPremium,
        :note,
        NOW()
      )
      `,
      {
        userId,
        itemId: shopItem.item_id,
        quantity,
        unitPriceGold: shopItem.price_gold || 0,
        unitPricePremium: shopItem.price_premium || 0,
        totalGold,
        totalPremium,
        note: `Mua vật phẩm ${shopItem.item_name} từ shop`,
      }
    );

    return {
      itemId: Number(shopItem.item_id),
      itemName: shopItem.item_name,
      quantity,
      totalGold,
      totalPremium,
    };
  });
}

// =========================
// ADMIN - ITEM TYPES
// =========================

async function listItemTypesAdmin() {
  return query(
    `
    SELECT *
    FROM item_types
    ORDER BY id ASC
    `
  );
}

async function createItemTypeAdmin(payload) {
  const { code, name, description = null } = payload || {};

  if (!code || !name) {
    throw new ApiError(400, 'code và name là bắt buộc');
  }

  return transaction(async (conn) => {
    const dupRows = await queryWithConn(
      conn,
      `
      SELECT id
      FROM item_types
      WHERE code = :code
      LIMIT 1
      `,
      { code }
    );

    if (dupRows.length) {
      throw new ApiError(400, 'Mã loại vật phẩm đã tồn tại');
    }

    const [result] = await conn.query(
      `
      INSERT INTO item_types (
        code,
        name,
        description,
        created_at,
        updated_at
      )
      VALUES (
        :code,
        :name,
        :description,
        NOW(),
        NOW()
      )
      `,
      { code, name, description }
    );

    const rows = await queryWithConn(
      conn,
      `SELECT * FROM item_types WHERE id = :id LIMIT 1`,
      { id: result.insertId }
    );

    return rows[0];
  });
}

async function updateItemTypeAdmin(id, payload) {
  const rows = await query(
    `
    SELECT *
    FROM item_types
    WHERE id = :id
    LIMIT 1
    `,
    { id }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy loại vật phẩm');
  }

  const current = rows[0];
  const code = payload?.code ?? current.code;
  const name = payload?.name ?? current.name;
  const description = payload?.description ?? current.description;

  if (!code || !name) {
    throw new ApiError(400, 'code và name là bắt buộc');
  }

  const dupRows = await query(
    `
    SELECT id
    FROM item_types
    WHERE code = :code
      AND id <> :id
    LIMIT 1
    `,
    { code, id }
  );

  if (dupRows.length) {
    throw new ApiError(400, 'Mã loại vật phẩm đã tồn tại');
  }

  await query(
    `
    UPDATE item_types
    SET code = :code,
        name = :name,
        description = :description,
        updated_at = NOW()
    WHERE id = :id
    `,
    { id, code, name, description }
  );

  const updated = await query(
    `
    SELECT *
    FROM item_types
    WHERE id = :id
    LIMIT 1
    `,
    { id }
  );

  return updated[0];
}

// =========================
// ADMIN - ITEMS
// =========================

async function listItemsAdmin() {
  return query(
    `
    SELECT
      i.*,
      it.code AS item_type_code,
      it.name AS item_type_name
    FROM items i
    INNER JOIN item_types it ON it.id = i.item_type_id
    ORDER BY i.id ASC
    `
  );
}

async function createItemAdmin(payload, _actorUserId) {
  const {
    item_type_id,
    code,
    name,
    description = null,
    icon_url = null,
    rarity = 'common',
    is_stackable = 1,
    max_stack = 999,
    usable_instantly = 0,
    equippable = 0,
    exp_bonus = 0,
    power_bonus = 0,
    afk_bonus_percent = 0,
    vip_required_level = 0,
    sellable = 1,
    is_active = 1,
  } = payload || {};

  if (!item_type_id || !code || !name) {
    throw new ApiError(400, 'item_type_id, code và name là bắt buộc');
  }

  const validRarities = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  if (!validRarities.includes(rarity)) {
    throw new ApiError(400, 'rarity không hợp lệ');
  }

  return transaction(async (conn) => {
    const typeRows = await queryWithConn(
      conn,
      `
      SELECT id
      FROM item_types
      WHERE id = :itemTypeId
      LIMIT 1
      `,
      { itemTypeId: item_type_id }
    );

    if (!typeRows.length) {
      throw new ApiError(404, 'Không tìm thấy item type');
    }

    const dupRows = await queryWithConn(
      conn,
      `
      SELECT id
      FROM items
      WHERE code = :code
      LIMIT 1
      `,
      { code }
    );

    if (dupRows.length) {
      throw new ApiError(400, 'Mã item đã tồn tại');
    }

    const [result] = await conn.query(
      `
      INSERT INTO items (
        item_type_id,
        code,
        name,
        description,
        icon_url,
        rarity,
        is_stackable,
        max_stack,
        usable_instantly,
        equippable,
        exp_bonus,
        power_bonus,
        afk_bonus_percent,
        vip_required_level,
        sellable,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        :item_type_id,
        :code,
        :name,
        :description,
        :icon_url,
        :rarity,
        :is_stackable,
        :max_stack,
        :usable_instantly,
        :equippable,
        :exp_bonus,
        :power_bonus,
        :afk_bonus_percent,
        :vip_required_level,
        :sellable,
        :is_active,
        NOW(),
        NOW()
      )
      `,
      {
        item_type_id: normalizeRequiredNumber(item_type_id, 'item_type_id'),
        code,
        name,
        description,
        icon_url,
        rarity,
        is_stackable: normalizeBoolean(is_stackable, 1),
        max_stack: normalizeRequiredNumber(max_stack, 'max_stack'),
        usable_instantly: normalizeBoolean(usable_instantly, 0),
        equippable: normalizeBoolean(equippable, 0),
        exp_bonus: normalizeRequiredNumber(exp_bonus, 'exp_bonus'),
        power_bonus: normalizeRequiredNumber(power_bonus, 'power_bonus'),
        afk_bonus_percent: Number(afk_bonus_percent || 0),
        vip_required_level: normalizeRequiredNumber(vip_required_level, 'vip_required_level'),
        sellable: normalizeBoolean(sellable, 1),
        is_active: normalizeBoolean(is_active, 1),
      }
    );

    const rows = await queryWithConn(
      conn,
      `
      SELECT i.*, it.code AS item_type_code, it.name AS item_type_name
      FROM items i
      INNER JOIN item_types it ON it.id = i.item_type_id
      WHERE i.id = :id
      LIMIT 1
      `,
      { id: result.insertId }
    );

    return rows[0];
  });
}

async function updateItemAdmin(id, payload, _actorUserId) {
  const rows = await query(
    `
    SELECT *
    FROM items
    WHERE id = :id
    LIMIT 1
    `,
    { id }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy item');
  }

  const current = rows[0];
  const next = {
    item_type_id: payload?.item_type_id ?? current.item_type_id,
    code: payload?.code ?? current.code,
    name: payload?.name ?? current.name,
    description: payload?.description ?? current.description,
    icon_url: payload?.icon_url ?? current.icon_url,
    rarity: payload?.rarity ?? current.rarity,
    is_stackable: payload?.is_stackable ?? current.is_stackable,
    max_stack: payload?.max_stack ?? current.max_stack,
    usable_instantly: payload?.usable_instantly ?? current.usable_instantly,
    equippable: payload?.equippable ?? current.equippable,
    exp_bonus: payload?.exp_bonus ?? current.exp_bonus,
    power_bonus: payload?.power_bonus ?? current.power_bonus,
    afk_bonus_percent: payload?.afk_bonus_percent ?? current.afk_bonus_percent,
    vip_required_level: payload?.vip_required_level ?? current.vip_required_level,
    sellable: payload?.sellable ?? current.sellable,
    is_active: payload?.is_active ?? current.is_active,
  };

  const validRarities = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  if (!validRarities.includes(next.rarity)) {
    throw new ApiError(400, 'rarity không hợp lệ');
  }

  const typeRows = await query(
    `
    SELECT id
    FROM item_types
    WHERE id = :itemTypeId
    LIMIT 1
    `,
    { itemTypeId: next.item_type_id }
  );

  if (!typeRows.length) {
    throw new ApiError(404, 'Không tìm thấy item type');
  }

  const dupRows = await query(
    `
    SELECT id
    FROM items
    WHERE code = :code
      AND id <> :id
    LIMIT 1
    `,
    { code: next.code, id }
  );

  if (dupRows.length) {
    throw new ApiError(400, 'Mã item đã tồn tại');
  }

  await query(
    `
    UPDATE items
    SET item_type_id = :item_type_id,
        code = :code,
        name = :name,
        description = :description,
        icon_url = :icon_url,
        rarity = :rarity,
        is_stackable = :is_stackable,
        max_stack = :max_stack,
        usable_instantly = :usable_instantly,
        equippable = :equippable,
        exp_bonus = :exp_bonus,
        power_bonus = :power_bonus,
        afk_bonus_percent = :afk_bonus_percent,
        vip_required_level = :vip_required_level,
        sellable = :sellable,
        is_active = :is_active,
        updated_at = NOW()
    WHERE id = :id
    `,
    {
      id,
      item_type_id: normalizeRequiredNumber(next.item_type_id, 'item_type_id'),
      code: next.code,
      name: next.name,
      description: next.description,
      icon_url: next.icon_url,
      rarity: next.rarity,
      is_stackable: normalizeBoolean(next.is_stackable, 1),
      max_stack: normalizeRequiredNumber(next.max_stack, 'max_stack'),
      usable_instantly: normalizeBoolean(next.usable_instantly, 0),
      equippable: normalizeBoolean(next.equippable, 0),
      exp_bonus: normalizeRequiredNumber(next.exp_bonus, 'exp_bonus'),
      power_bonus: normalizeRequiredNumber(next.power_bonus, 'power_bonus'),
      afk_bonus_percent: Number(next.afk_bonus_percent || 0),
      vip_required_level: normalizeRequiredNumber(next.vip_required_level, 'vip_required_level'),
      sellable: normalizeBoolean(next.sellable, 1),
      is_active: normalizeBoolean(next.is_active, 1),
    }
  );

  const updated = await query(
    `
    SELECT i.*, it.code AS item_type_code, it.name AS item_type_name
    FROM items i
    INNER JOIN item_types it ON it.id = i.item_type_id
    WHERE i.id = :id
    LIMIT 1
    `,
    { id }
  );

  return updated[0];
}

// =========================
// ADMIN - SHOP ITEMS
// =========================

async function listShopItemsAdmin() {
  return query(
    `
    SELECT
      si.*,
      i.code AS item_code,
      i.name AS item_name
    FROM shop_items si
    INNER JOIN items i ON i.id = si.item_id
    ORDER BY si.id ASC
    `
  );
}

async function createShopItemAdmin(payload) {
  const {
    item_id,
    price_gold = 0,
    price_premium = 0,
    stock_quantity = null,
    daily_purchase_limit = null,
    vip_required_level = 0,
    start_at = null,
    end_at = null,
    is_active = 1,
  } = payload || {};

  if (!item_id) {
    throw new ApiError(400, 'item_id là bắt buộc');
  }

  return transaction(async (conn) => {
    const itemRows = await queryWithConn(
      conn,
      `
      SELECT id
      FROM items
      WHERE id = :itemId
      LIMIT 1
      `,
      { itemId: item_id }
    );

    if (!itemRows.length) {
      throw new ApiError(404, 'Không tìm thấy item');
    }

    const dupRows = await queryWithConn(
      conn,
      `
      SELECT id
      FROM shop_items
      WHERE item_id = :itemId
      LIMIT 1
      `,
      { itemId: item_id }
    );

    if (dupRows.length) {
      throw new ApiError(400, 'Item này đã tồn tại trong shop');
    }

    const [result] = await conn.query(
      `
      INSERT INTO shop_items (
        item_id,
        price_gold,
        price_premium,
        stock_quantity,
        daily_purchase_limit,
        vip_required_level,
        start_at,
        end_at,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        :item_id,
        :price_gold,
        :price_premium,
        :stock_quantity,
        :daily_purchase_limit,
        :vip_required_level,
        :start_at,
        :end_at,
        :is_active,
        NOW(),
        NOW()
      )
      `,
      {
        item_id: normalizeRequiredNumber(item_id, 'item_id'),
        price_gold: Number(price_gold || 0),
        price_premium: Number(price_premium || 0),
        stock_quantity: normalizeNullableNumber(stock_quantity),
        daily_purchase_limit: normalizeNullableNumber(daily_purchase_limit),
        vip_required_level: normalizeRequiredNumber(vip_required_level, 'vip_required_level'),
        start_at,
        end_at,
        is_active: normalizeBoolean(is_active, 1),
      }
    );

    const rows = await queryWithConn(
      conn,
      `
      SELECT si.*, i.code AS item_code, i.name AS item_name
      FROM shop_items si
      INNER JOIN items i ON i.id = si.item_id
      WHERE si.id = :id
      LIMIT 1
      `,
      { id: result.insertId }
    );

    return rows[0];
  });
}

async function updateShopItemAdmin(id, payload) {
  const rows = await query(
    `
    SELECT *
    FROM shop_items
    WHERE id = :id
    LIMIT 1
    `,
    { id }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy shop item');
  }

  const current = rows[0];
  const next = {
    item_id: payload?.item_id ?? current.item_id,
    price_gold: payload?.price_gold ?? current.price_gold,
    price_premium: payload?.price_premium ?? current.price_premium,
    stock_quantity: payload?.stock_quantity ?? current.stock_quantity,
    daily_purchase_limit: payload?.daily_purchase_limit ?? current.daily_purchase_limit,
    vip_required_level: payload?.vip_required_level ?? current.vip_required_level,
    start_at: payload?.start_at ?? current.start_at,
    end_at: payload?.end_at ?? current.end_at,
    is_active: payload?.is_active ?? current.is_active,
  };

  const itemRows = await query(
    `
    SELECT id
    FROM items
    WHERE id = :itemId
    LIMIT 1
    `,
    { itemId: next.item_id }
  );

  if (!itemRows.length) {
    throw new ApiError(404, 'Không tìm thấy item');
  }

  const dupRows = await query(
    `
    SELECT id
    FROM shop_items
    WHERE item_id = :itemId
      AND id <> :id
    LIMIT 1
    `,
    { itemId: next.item_id, id }
  );

  if (dupRows.length) {
    throw new ApiError(400, 'Item này đã tồn tại trong shop');
  }

  await query(
    `
    UPDATE shop_items
    SET item_id = :item_id,
        price_gold = :price_gold,
        price_premium = :price_premium,
        stock_quantity = :stock_quantity,
        daily_purchase_limit = :daily_purchase_limit,
        vip_required_level = :vip_required_level,
        start_at = :start_at,
        end_at = :end_at,
        is_active = :is_active,
        updated_at = NOW()
    WHERE id = :id
    `,
    {
      id,
      item_id: normalizeRequiredNumber(next.item_id, 'item_id'),
      price_gold: Number(next.price_gold || 0),
      price_premium: Number(next.price_premium || 0),
      stock_quantity: normalizeNullableNumber(next.stock_quantity),
      daily_purchase_limit: normalizeNullableNumber(next.daily_purchase_limit),
      vip_required_level: normalizeRequiredNumber(next.vip_required_level, 'vip_required_level'),
      start_at: next.start_at,
      end_at: next.end_at,
      is_active: normalizeBoolean(next.is_active, 1),
    }
  );

  const updated = await query(
    `
    SELECT si.*, i.code AS item_code, i.name AS item_name
    FROM shop_items si
    INNER JOIN items i ON i.id = si.item_id
    WHERE si.id = :id
    LIMIT 1
    `,
    { id }
  );

  return updated[0];
}



async function deleteItemTypeAdmin(id) {
  const linkedRows = await query(
    `SELECT COUNT(*) AS total FROM items WHERE item_type_id = :id`,
    { id }
  );

  if (Number(linkedRows[0]?.total || 0) > 0) {
    throw new ApiError(400, 'Loại vật phẩm này đang được item sử dụng, chưa thể xóa');
  }

  await query(`DELETE FROM item_types WHERE id = :id`, { id });
  return { id: Number(id), deleted: true };
}

async function deleteItemAdmin(id) {
  const rows = await query(`SELECT id FROM items WHERE id = :id LIMIT 1`, { id });
  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy item');
  }

  await query(
    `UPDATE items SET is_active = 0, updated_at = NOW() WHERE id = :id`,
    { id }
  );

  await query(
    `UPDATE shop_items SET is_active = 0, updated_at = NOW() WHERE item_id = :id`,
    { id }
  );

  return { id: Number(id), deleted: true };
}

async function deleteShopItemAdmin(id) {
  const rows = await query(`SELECT id FROM shop_items WHERE id = :id LIMIT 1`, { id });
  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy shop item');
  }

  await query(
    `UPDATE shop_items SET is_active = 0, updated_at = NOW() WHERE id = :id`,
    { id }
  );

  return { id: Number(id), deleted: true };
}

async function listTransactionsAdmin(filters = {}) {
  const q = filters.q ? `%${String(filters.q).trim()}%` : null;
  const transactionType = filters.transactionType || null;
  const status = filters.status || null;
  const dateFrom = filters.dateFrom || null;
  const dateTo = filters.dateTo || null;

  const itemRows = await query(
    `SELECT
        itx.id,
        CONCAT('ITX-', LPAD(itx.id, 4, '0')) AS transaction_code,
        'item' AS source_type,
        itx.transaction_type,
        'success' AS transaction_status,
        itx.quantity,
        itx.total_price_gold AS total_amount,
        'gold' AS currency_code,
        itx.note,
        itx.created_at,
        u.id AS user_id,
        u.display_name,
        u.username,
        u.avatar_url,
        i.id AS item_id,
        i.name AS item_name,
        i.icon_url AS item_icon_url
      FROM item_transactions itx
      INNER JOIN users u ON u.id = itx.user_id
      INNER JOIN items i ON i.id = itx.item_id
      WHERE (:q IS NULL OR CONCAT(IFNULL(u.display_name,''), ' ', IFNULL(u.username,''), ' ', IFNULL(i.name,''), ' ', IFNULL(itx.note,'')) LIKE :q)
        AND (:transactionType IS NULL OR itx.transaction_type = :transactionType)
        AND (:status IS NULL OR :status = 'success')
        AND (:dateFrom IS NULL OR DATE(itx.created_at) >= DATE(:dateFrom))
        AND (:dateTo IS NULL OR DATE(itx.created_at) <= DATE(:dateTo))
      ORDER BY itx.created_at DESC`,
    { q, transactionType, status, dateFrom, dateTo }
  );

  const paymentRows = await query(
    `SELECT
        ptx.id,
        CONCAT('PTX-', LPAD(ptx.id, 4, '0')) AS transaction_code,
        'payment' AS source_type,
        ptx.payment_method AS transaction_type,
        ptx.payment_status AS transaction_status,
        1 AS quantity,
        ptx.amount AS total_amount,
        ptx.currency_code,
        ptx.external_txn_code AS note,
        ptx.created_at,
        u.id AS user_id,
        u.display_name,
        u.username,
        u.avatar_url,
        NULL AS item_id,
        COALESCE(pp.name, 'Nạp tiền') AS item_name,
        NULL AS item_icon_url
      FROM payment_transactions ptx
      INNER JOIN users u ON u.id = ptx.user_id
      LEFT JOIN payment_packages pp ON pp.id = ptx.payment_package_id
      WHERE (:q IS NULL OR CONCAT(IFNULL(u.display_name,''), ' ', IFNULL(u.username,''), ' ', IFNULL(pp.name,''), ' ', IFNULL(ptx.external_txn_code,'')) LIKE :q)
        AND (:transactionType IS NULL OR ptx.payment_method = :transactionType)
        AND (:status IS NULL OR ptx.payment_status = :status)
        AND (:dateFrom IS NULL OR DATE(ptx.created_at) >= DATE(:dateFrom))
        AND (:dateTo IS NULL OR DATE(ptx.created_at) <= DATE(:dateTo))
      ORDER BY ptx.created_at DESC`,
    { q, transactionType, status, dateFrom, dateTo }
  );

  const transactions = [...itemRows, ...paymentRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const today = new Date().toISOString().slice(0, 10);
  const stats = {
    total: transactions.length,
    revenueToday: transactions
      .filter((item) => String(item.created_at).slice(0, 10) === today && ['success', 'claimed'].includes(String(item.transaction_status || '').toLowerCase()))
      .reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
    success: transactions.filter((item) => ['success', 'claimed'].includes(String(item.transaction_status || '').toLowerCase())).length,
    failed: transactions.filter((item) => ['failed', 'cancelled', 'refunded'].includes(String(item.transaction_status || '').toLowerCase())).length,
  };

  return { stats, items: transactions };
}

module.exports = {
  listShopItems,
  buyItem,
  listItemTypesAdmin,
  createItemTypeAdmin,
  updateItemTypeAdmin,
  deleteItemTypeAdmin,
  listItemsAdmin,
  createItemAdmin,
  updateItemAdmin,
  deleteItemAdmin,
  listShopItemsAdmin,
  createShopItemAdmin,
  updateShopItemAdmin,
  deleteShopItemAdmin,
  listTransactionsAdmin,
};