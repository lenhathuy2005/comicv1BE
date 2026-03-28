const { query, queryWithConn, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

async function listGuilds() {
  return query(
    `
    SELECT
      g.*,
      u.display_name AS leader_name
    FROM guilds g
    LEFT JOIN users u ON u.id = g.leader_user_id
    WHERE g.guild_status = 'active'
    ORDER BY g.id DESC
    `
  );
}

async function getGuildDetail(guildId) {
  const rows = await query(
    `
    SELECT
      g.*,
      u.display_name AS leader_name
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
      gr.name AS role_name
    FROM guild_members gm
    LEFT JOIN users u ON u.id = gm.user_id
    LEFT JOIN guild_roles gr ON gr.id = gm.guild_role_id
    WHERE gm.guild_id = :guildId
      AND gm.join_status = 'active'
    ORDER BY gm.joined_at ASC
    `,
    { guildId }
  );
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
        throw new ApiError(404, 'Không tìm thấy vật phẩm trong kho');
      }

      if (Number(inventoryRows[0].quantity) < numericQuantity) {
        throw new ApiError(400, 'Số lượng vật phẩm không đủ');
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
          inventoryId: inventoryRows[0].id,
        }
      );

      contributionIncrease = numericQuantity;
      guildPowerIncrease = numericQuantity;
    }

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
      guildId: Number(guildId),
      userId: Number(userId),
      donationType,
      amount: numericAmount,
      itemId,
      quantity: numericQuantity,
      contributionIncrease,
      guildPowerIncrease,
    };
  });
}

module.exports = {
  listGuilds,
  getGuildDetail,
  createGuild,
  requestJoinGuild,
  approveJoinRequest,
  donateToGuild,
  listGuildMembers,
};