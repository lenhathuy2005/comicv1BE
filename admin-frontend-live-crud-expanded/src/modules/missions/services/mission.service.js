const { query } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');
const cultivationService = require('../../cultivation/services/cultivation.service');

async function ensureMissionExists(missionId) {
  const rows = await query(
    `
    SELECT *
    FROM missions
    WHERE id = :missionId
    LIMIT 1
    `,
    { missionId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy mission');
  }

  return rows[0];
}

function timeframeCondition(alias, missionType) {
  if (missionType === 'daily') {
    return `DATE(${alias}) = CURDATE()`;
  }

  if (missionType === 'weekly') {
    return `${alias} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
  }

  return '1 = 1';
}

async function getCurrentProgress(userId, mission) {
  const targetType = mission.target_type;
  const missionType = mission.mission_type;

  if (targetType === 'login') return 1;

  if (targetType === 'read_chapter') {
    const [row] = await query(
      `
      SELECT COUNT(*) AS total
      FROM reading_history
      WHERE user_id = :userId
        AND ${timeframeCondition('last_read_at', missionType)}
      `,
      { userId }
    );
    return Number(row?.total || 0);
  }

  if (targetType === 'comment') {
    const [row] = await query(
      `
      SELECT COUNT(*) AS total
      FROM comments
      WHERE user_id = :userId
        AND comment_status <> 'deleted'
        AND ${timeframeCondition('created_at', missionType)}
      `,
      { userId }
    );
    return Number(row?.total || 0);
  }

  if (targetType === 'afk') {
    const [row] = await query(
      `
      SELECT COUNT(*) AS total
      FROM afk_sessions
      WHERE user_id = :userId
        AND (session_status = 'ended' OR session_status = 'finished' OR claim_status = 'claimed')
        AND ${timeframeCondition('created_at', missionType)}
      `,
      { userId }
    );
    return Number(row?.total || 0);
  }

  if (targetType === 'buy_item') {
    const [row] = await query(
      `
      SELECT COUNT(*) AS total
      FROM item_transactions
      WHERE user_id = :userId
        AND transaction_type IN ('buy_from_shop', 'shop_buy', 'shop_purchase', 'buy')
        AND ${timeframeCondition('created_at', missionType)}
      `,
      { userId }
    );
    return Number(row?.total || 0);
  }

  if (targetType === 'join_guild') {
    const [row] = await query(
      `
      SELECT COUNT(*) AS total
      FROM guild_members
      WHERE user_id = :userId
        AND join_status = 'active'
      `,
      { userId }
    );
    return Number(row?.total || 0);
  }

  if (targetType === 'chat') {
    const [row] = await query(
      `
      SELECT COUNT(*) AS total
      FROM chat_messages
      WHERE user_id = :userId
        AND is_deleted = 0
        AND ${timeframeCondition('sent_at', missionType)}
      `,
      { userId }
    );
    return Number(row?.total || 0);
  }

  return null;
}

async function getActiveMissions(type = null) {
  let sql = `
    SELECT *
    FROM missions
    WHERE is_active = 1
      AND (start_at IS NULL OR start_at <= NOW())
      AND (end_at IS NULL OR end_at >= NOW())
  `;

  const params = {};

  if (type) {
    sql += ` AND mission_type = :type `;
    params.type = type;
  }

  sql += ` ORDER BY FIELD(mission_type, 'daily', 'weekly', 'event', 'story'), id DESC `;

  return query(sql, params);
}

async function ensureUserMissionRows(userId, type = null) {
  const missions = await getActiveMissions(type);

  for (const mission of missions) {
    let existing;

    if (mission.mission_type === 'daily' || mission.mission_type === 'weekly') {
      existing = await query(
        `
        SELECT id
        FROM user_missions
        WHERE user_id = :userId
          AND mission_id = :missionId
          AND assigned_date = CURDATE()
        LIMIT 1
        `,
        { userId, missionId: mission.id }
      );
    } else {
      existing = await query(
        `
        SELECT id
        FROM user_missions
        WHERE user_id = :userId
          AND mission_id = :missionId
        ORDER BY id DESC
        LIMIT 1
        `,
        { userId, missionId: mission.id }
      );
    }

    if (!existing.length) {
      await query(
        `
        INSERT INTO user_missions (
          user_id,
          mission_id,
          progress_value,
          mission_status,
          assigned_date,
          created_at,
          updated_at
        ) VALUES (
          :userId,
          :missionId,
          0,
          'in_progress',
          CURDATE(),
          NOW(),
          NOW()
        )
        `,
        { userId, missionId: mission.id }
      );
    }
  }
}

async function syncMissionProgress(userId, rows) {
  const synced = [];

  for (const row of rows) {
    const computed = await getCurrentProgress(userId, row);
    const currentProgress = computed === null
      ? Number(row.progress_value || 0)
      : Math.max(Number(row.progress_value || 0), Number(computed || 0));

    let status = row.mission_status;

    if (status === 'in_progress' && currentProgress >= Number(row.target_value || 1)) {
      status = 'completed';
      await query(
        `
        UPDATE user_missions
        SET progress_value = :progressValue,
            mission_status = 'completed',
            completed_at = COALESCE(completed_at, NOW()),
            updated_at = NOW()
        WHERE id = :userMissionId
        `,
        { userMissionId: row.user_mission_id, progressValue: currentProgress }
      );
    } else if (currentProgress !== Number(row.progress_value || 0)) {
      await query(
        `
        UPDATE user_missions
        SET progress_value = :progressValue,
            updated_at = NOW()
        WHERE id = :userMissionId
        `,
        { userMissionId: row.user_mission_id, progressValue: currentProgress }
      );
    }

    synced.push({
      ...row,
      progress_value: currentProgress,
      mission_status: status,
    });
  }

  return synced;
}

async function listMyMissions({ userId, type = null }) {
  await ensureUserMissionRows(userId, type);

  let sql = `
    SELECT
      um.id AS user_mission_id,
      um.user_id,
      um.mission_id,
      um.progress_value,
      um.mission_status,
      um.completed_at,
      um.claimed_at,
      m.title,
      m.description,
      m.mission_type,
      m.target_type,
      m.target_value,
      m.reward_gold,
      m.reward_exp,
      m.reward_item_id,
      m.reward_item_qty,
      m.is_active,
      m.start_at,
      m.end_at
    FROM user_missions um
    INNER JOIN missions m ON m.id = um.mission_id
    WHERE um.user_id = :userId
      AND m.is_active = 1
      AND (m.start_at IS NULL OR m.start_at <= NOW())
      AND (m.end_at IS NULL OR m.end_at >= NOW())
  `;

  const params = { userId };

  if (type) {
    sql += ` AND m.mission_type = :type `;
    params.type = type;
  }

  sql += `
    ORDER BY
      FIELD(um.mission_status, 'completed', 'in_progress', 'claimed', 'expired'),
      FIELD(m.mission_type, 'daily', 'weekly', 'event', 'story'),
      um.id DESC
  `;

  const rows = await query(sql, params);
  const syncedRows = await syncMissionProgress(userId, rows);

  return {
    items: syncedRows.map((row) => ({
      user_mission_id: row.user_mission_id,
      mission_id: row.mission_id,
      title: row.title,
      description: row.description,
      mission_type: row.mission_type,
      target_type: row.target_type,
      target_value: Number(row.target_value || 1),
      progress_value: Number(row.progress_value || 0),
      mission_status: row.mission_status,
      is_completed: row.mission_status === 'completed' || row.mission_status === 'claimed',
      is_claimed: row.mission_status === 'claimed',
      completed_at: row.completed_at,
      claimed_at: row.claimed_at,
      reward: {
        gold: Number(row.reward_gold || 0),
        exp: Number(row.reward_exp || 0),
        item_id: row.reward_item_id || null,
        item_qty: Number(row.reward_item_qty || 0),
      },
      is_active: Number(row.is_active) === 1,
    })),
  };
}

async function ensureUserMissionExists(userId, missionId) {
  const rows = await query(
    `
    SELECT *
    FROM user_missions
    WHERE user_id = :userId
      AND mission_id = :missionId
    ORDER BY id DESC
    LIMIT 1
    `,
    { userId, missionId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'User chưa có mission này');
  }

  return rows[0];
}

async function ensureUserProfile(userId) {
  const rows = await query(
    `SELECT id FROM user_profiles WHERE user_id = :userId LIMIT 1`,
    { userId }
  );

  if (rows.length) return;

  await query(
    `
    INSERT INTO user_profiles (user_id, created_at, updated_at)
    VALUES (:userId, NOW(), NOW())
    `,
    { userId }
  );
}

async function grantMissionReward({ userId, mission }) {
  await ensureUserProfile(userId);

  const rewardGold = Number(mission.reward_gold || 0);
  const rewardExp = Number(mission.reward_exp || 0);
  const rewardItemId = mission.reward_item_id ? Number(mission.reward_item_id) : null;
  const rewardItemQty = Number(mission.reward_item_qty || 0);

  if (rewardGold > 0) {
    await query(
      `
      UPDATE user_profiles
      SET gold_balance = gold_balance + :rewardGold,
          updated_at = NOW()
      WHERE user_id = :userId
      `,
      { userId, rewardGold }
    );
  }

  if (rewardExp > 0) {
    // Dùng service cảnh giới trung tâm để EXP nhiệm vụ cũng tự lên tầng 1-9
    // và tự dừng ở tầng 10 chờ đột phá.
    await cultivationService.addExpToUser(userId, rewardExp);
  }

  if (rewardItemId && rewardItemQty > 0) {
    await query(
      `
      INSERT INTO user_inventory (
        user_id,
        item_id,
        quantity,
        is_bound,
        obtained_from,
        created_at,
        updated_at
      ) VALUES (
        :userId,
        :itemId,
        :quantity,
        1,
        'mission_reward',
        NOW(),
        NOW()
      )
      ON DUPLICATE KEY UPDATE
        quantity = quantity + VALUES(quantity),
        updated_at = NOW()
      `,
      { userId, itemId: rewardItemId, quantity: rewardItemQty }
    );
  }
}

async function claimMissionReward({ userId, missionId }) {
  if (!missionId || Number.isNaN(Number(missionId))) {
    throw new ApiError(400, 'missionId không hợp lệ');
  }

  const mission = await ensureMissionExists(missionId);
  const userMission = await ensureUserMissionExists(userId, missionId);

  if (!Number(mission.is_active)) {
    throw new ApiError(400, 'Mission hiện không hoạt động');
  }

  if (mission.start_at && new Date(mission.start_at) > new Date()) {
    throw new ApiError(400, 'Mission chưa bắt đầu');
  }

  if (mission.end_at && new Date(mission.end_at) < new Date()) {
    throw new ApiError(400, 'Mission đã kết thúc');
  }

  const computed = await getCurrentProgress(userId, mission);
  const progress = computed === null
    ? Number(userMission.progress_value || 0)
    : Math.max(Number(userMission.progress_value || 0), Number(computed || 0));

  let status = userMission.mission_status;
  if (status === 'in_progress' && progress >= Number(mission.target_value || 1)) {
    status = 'completed';
    await query(
      `
      UPDATE user_missions
      SET progress_value = :progress,
          mission_status = 'completed',
          completed_at = COALESCE(completed_at, NOW()),
          updated_at = NOW()
      WHERE id = :userMissionId
      `,
      { userMissionId: userMission.id, progress }
    );
  }

  if (status !== 'completed') {
    if (status === 'claimed') {
      throw new ApiError(400, 'Mission đã được nhận thưởng');
    }

    throw new ApiError(400, 'Mission chưa hoàn thành');
  }

  await grantMissionReward({ userId, mission });

  await query(
    `
    UPDATE user_missions
    SET mission_status = 'claimed',
        claimed_at = NOW(),
        progress_value = :progress,
        updated_at = NOW()
    WHERE id = :userMissionId
    `,
    { userMissionId: userMission.id, progress }
  );

  const updatedUserMission = await query(
    `
    SELECT *
    FROM user_missions
    WHERE id = :userMissionId
    LIMIT 1
    `,
    { userMissionId: userMission.id }
  );

  return {
    mission_id: mission.id,
    title: mission.title,
    reward: {
      gold: Number(mission.reward_gold || 0),
      exp: Number(mission.reward_exp || 0),
      item_id: mission.reward_item_id || null,
      item_qty: Number(mission.reward_item_qty || 0),
    },
    user_mission: updatedUserMission[0],
  };
}

module.exports = {
  listMyMissions,
  claimMissionReward,
};
