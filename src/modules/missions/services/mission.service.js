const { query } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

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

async function ensureUserMissionExists(userId, missionId) {
  const rows = await query(
    `
    SELECT *
    FROM user_missions
    WHERE user_id = :userId
      AND mission_id = :missionId
    LIMIT 1
    `,
    { userId, missionId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'User chưa có mission này');
  }

  return rows[0];
}

async function listMyMissions({ userId, type = null }) {
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
      m.target_value,
      m.reward_gold,
      m.reward_exp,
      m.is_active
    FROM user_missions um
    INNER JOIN missions m ON m.id = um.mission_id
    WHERE um.user_id = :userId
  `;

  const params = { userId };

  if (type) {
    sql += ` AND m.mission_type = :type `;
    params.type = type;
  }

  sql += ` ORDER BY um.id DESC `;

  const rows = await query(sql, params);

  return {
    items: rows.map((row) => ({
      user_mission_id: row.user_mission_id,
      mission_id: row.mission_id,
      title: row.title,
      description: row.description,
      mission_type: row.mission_type,
      target_value: row.target_value,
      progress_value: row.progress_value,
      mission_status: row.mission_status,
      is_completed:
        row.mission_status === 'completed' || row.mission_status === 'claimed',
      is_claimed: row.mission_status === 'claimed',
      completed_at: row.completed_at,
      claimed_at: row.claimed_at,
      reward: {
        gold: row.reward_gold,
        exp: row.reward_exp,
      },
      is_active: Number(row.is_active) === 1,
    })),
  };
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

  if (userMission.mission_status !== 'completed') {
    if (userMission.mission_status === 'claimed') {
      throw new ApiError(400, 'Mission đã được nhận thưởng');
    }

    throw new ApiError(400, 'Mission chưa hoàn thành');
  }

  await query(
    `
    UPDATE user_missions
    SET mission_status = 'claimed',
        claimed_at = NOW(),
        updated_at = NOW()
    WHERE id = :userMissionId
    `,
    { userMissionId: userMission.id }
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
      gold: mission.reward_gold || 0,
      exp: mission.reward_exp || 0,
    },
    user_mission: updatedUserMission[0],
  };
}

module.exports = {
  listMyMissions,
  claimMissionReward,
};