const { query, queryWithConn, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

function normalizeBoolean(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === true || value === 'true' || value === 1 || value === '1') return 1;
  return 0;
}

function normalizeItemUsageType(value, currentUsable = 0) {
  if (value === undefined || value === null || value === '') {
    return normalizeBoolean(currentUsable, 0);
  }

  const normalized = String(value).trim().toLowerCase();

  if (['active', 'activation', 'usable', 'use', 'kich_hoat', 'kích hoạt', '1', 'true'].includes(normalized)) {
    return 1;
  }

  if (['static', 'passive', 'tinh', 'tĩnh', '0', 'false'].includes(normalized)) {
    return 0;
  }

  throw new ApiError(400, 'Loại vật phẩm phải là kích hoạt hoặc tĩnh');
}

function normalizeNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function normalizeNullableDate(value) {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

function normalizeRequiredNumber(value, fieldName) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new ApiError(400, `${fieldName} không hợp lệ`);
  }
  return parsed;
}

function formatAmount(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';

  return number.toLocaleString('vi-VN', {
    maximumFractionDigits: 0,
  });
}


async function syncSellableItemsToShop(conn = null) {
  const runner = conn
    ? (sql, params) => queryWithConn(conn, sql, params)
    : (sql, params) => query(sql, params);

  // Nếu admin đã bật item là sellable + active nhưng chưa có dòng shop_items,
  // user-facing shop sẽ không nhìn thấy. Tự đồng bộ để tránh admin thấy "đang bán"
  // nhưng app không hiện vật phẩm.
  await runner(
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
    SELECT
      i.id AS item_id,
      0 AS price_gold,
      0 AS price_premium,
      NULL AS stock_quantity,
      NULL AS daily_purchase_limit,
      COALESCE(i.vip_required_level, 0) AS vip_required_level,
      NULL AS start_at,
      NULL AS end_at,
      1 AS is_active,
      NOW() AS created_at,
      NOW() AS updated_at
    FROM items i
    LEFT JOIN shop_items si ON si.item_id = i.id
    WHERE si.id IS NULL
      AND COALESCE(i.is_active, 0) = 1
      AND COALESCE(i.sellable, 0) = 1
    `,
    {}
  );
}


// =========================
// USER-FACING
// =========================

async function listShopItems() {
  await syncSellableItemsToShop();

  const sql = `
    SELECT
      si.id,
      si.item_id,
      si.price_gold,
      si.price_premium,
      si.stock_quantity,
      si.daily_purchase_limit,
      si.buy_once_per_user,
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
      CASE WHEN i.usable_instantly = 1 THEN 'active' ELSE 'static' END AS item_usage_type,
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

    if (Number(shopItem.buy_once_per_user || 0) === 1) {
      if (quantity > 1) {
        throw new ApiError(400, 'Vật phẩm này chỉ được mua 1 lần duy nhất mỗi tài khoản');
      }

      const boughtRows = await queryWithConn(
        conn,
        `
        SELECT COALESCE(SUM(quantity), 0) AS bought_count
        FROM item_transactions
        WHERE user_id = :userId
          AND item_id = :itemId
          AND transaction_type = 'buy_from_shop'
        `,
        {
          userId,
          itemId: shopItem.item_id,
        }
      );

      if (Number(boughtRows[0]?.bought_count || 0) > 0) {
        throw new ApiError(400, 'Tài khoản này đã mua vật phẩm này rồi. Vật phẩm chỉ được mua 1 lần duy nhất.');
      }
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
    const currentGold = Number(profile.gold_balance || 0);
    const currentPremium = Number(profile.premium_currency || 0);
    const vipRequiredLevel = Number(shopItem.vip_required_level || 0);

    if (vipRequiredLevel > 0) {
      const vipRows = await queryWithConn(
        conn,
        `
        SELECT COALESCE(vl.level_number, 0) AS vip_level
        FROM user_vip uv
        LEFT JOIN vip_levels vl ON vl.id = uv.current_vip_level_id
        WHERE uv.user_id = :userId
        LIMIT 1
        `,
        { userId }
      );

      const currentVipLevel = Number(vipRows[0]?.vip_level || 0);

      if (currentVipLevel < vipRequiredLevel) {
        throw new ApiError(
          400,
          `Chưa đủ yêu cầu VIP ${vipRequiredLevel} để mua vật phẩm này`
        );
      }
    }

    if (shopItem.daily_purchase_limit !== null) {
      const limit = Number(shopItem.daily_purchase_limit || 0);

      if (limit > 0) {
        const purchasedRows = await queryWithConn(
          conn,
          `
          SELECT COALESCE(SUM(quantity), 0) AS purchased_today
          FROM item_transactions
          WHERE user_id = :userId
            AND item_id = :itemId
            AND transaction_type = 'buy_from_shop'
            AND DATE(created_at) = CURDATE()
          `,
          {
            userId,
            itemId: shopItem.item_id,
          }
        );

        const purchasedToday = Number(purchasedRows[0]?.purchased_today || 0);
        const remainingToday = Math.max(0, limit - purchasedToday);

        if (quantity > remainingToday) {
          throw new ApiError(
            400,
            `Vượt giới hạn mua hôm nay. Còn có thể mua ${remainingToday} vật phẩm.`
          );
        }
      }
    }

    if (currentGold < totalGold) {
      throw new ApiError(
        400,
        `Không đủ tiền để mua vật phẩm. Cần ${formatAmount(totalGold)} vàng, hiện có ${formatAmount(currentGold)} vàng.`
      );
    }

    if (currentPremium < totalPremium) {
      throw new ApiError(
        400,
        `Không đủ tiền để mua vật phẩm. Cần ${formatAmount(totalPremium)} ngọc, hiện có ${formatAmount(currentPremium)} ngọc.`
      );
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
  await syncSellableItemsToShop();

  return query(
    `
    SELECT
      si.*,
      i.code AS item_code,
      i.name AS item_name,
      i.description AS item_description,
      i.icon_url,
      i.rarity,
      i.usable_instantly,
      CASE WHEN i.usable_instantly = 1 THEN 'active' ELSE 'static' END AS item_usage_type
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
    buy_once_per_user = 0,
    vip_required_level = 0,
    item_usage_type = null,
    icon_url = undefined,
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
      SELECT id, icon_url, usable_instantly
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
        buy_once_per_user,
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
        :buy_once_per_user,
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
        buy_once_per_user: normalizeBoolean(buy_once_per_user, 0),
        vip_required_level: normalizeRequiredNumber(vip_required_level, 'vip_required_level'),
        start_at: normalizeNullableDate(start_at),
        end_at: normalizeNullableDate(end_at),
        is_active: normalizeBoolean(is_active, 1),
      }
    );

    const itemUpdatePayload = {
      icon_url: icon_url !== undefined ? icon_url : itemRows[0].icon_url,
      usable_instantly: normalizeItemUsageType(item_usage_type, itemRows[0].usable_instantly),
      item_id,
    };

    if (icon_url !== undefined || item_usage_type !== null) {
      await conn.query(
        `
        UPDATE items
        SET icon_url = :icon_url,
            usable_instantly = :usable_instantly,
            updated_at = NOW()
        WHERE id = :item_id
        `,
        itemUpdatePayload
      );
    }

    const rows = await queryWithConn(
      conn,
      `
      SELECT
        si.*,
        i.code AS item_code,
        i.name AS item_name,
        i.icon_url,
        i.rarity,
        i.usable_instantly,
        CASE WHEN i.usable_instantly = 1 THEN 'active' ELSE 'static' END AS item_usage_type
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
    buy_once_per_user: payload?.buy_once_per_user ?? current.buy_once_per_user,
    vip_required_level: payload?.vip_required_level ?? current.vip_required_level,
    item_usage_type: payload?.item_usage_type ?? null,
    icon_url: payload?.icon_url,
    start_at: payload?.start_at ?? current.start_at,
    end_at: payload?.end_at ?? current.end_at,
    is_active: payload?.is_active ?? current.is_active,
  };

  const itemRows = await query(
    `
    SELECT id, icon_url, usable_instantly
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
        buy_once_per_user = :buy_once_per_user,
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
      buy_once_per_user: normalizeBoolean(next.buy_once_per_user, 0),
      vip_required_level: normalizeRequiredNumber(next.vip_required_level, 'vip_required_level'),
      start_at: normalizeNullableDate(next.start_at),
      end_at: normalizeNullableDate(next.end_at),
      is_active: normalizeBoolean(next.is_active, 1),
    }
  );

  if (next.icon_url !== undefined || next.item_usage_type !== null) {
    await query(
      `
      UPDATE items
      SET icon_url = COALESCE(:icon_url, icon_url),
          usable_instantly = :usable_instantly,
          updated_at = NOW()
      WHERE id = :item_id
      `,
      {
        item_id: normalizeRequiredNumber(next.item_id, 'item_id'),
        icon_url: next.icon_url === undefined ? null : next.icon_url,
        usable_instantly: normalizeItemUsageType(next.item_usage_type, itemRows[0].usable_instantly),
      }
    );
  }

  const updated = await query(
    `
    SELECT
      si.*,
      i.code AS item_code,
      i.name AS item_name,
      i.icon_url,
      i.rarity,
      i.usable_instantly,
      CASE WHEN i.usable_instantly = 1 THEN 'active' ELSE 'static' END AS item_usage_type
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