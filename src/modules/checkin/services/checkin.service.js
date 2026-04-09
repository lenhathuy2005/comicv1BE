const { query } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

function formatDateToYYYYMMDD(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayDate() {
  return formatDateToYYYYMMDD(new Date());
}

function getYesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDateToYYYYMMDD(d);
}

function calculateRewardByStreak(streakCount) {
  const safeStreak = Math.max(1, Number(streakCount) || 1);

  return {
    gold: safeStreak * 100,
    exp: safeStreak * 50,
  };
}

async function getLatestCheckin(userId) {
  const rows = await query(
    `
    SELECT *
    FROM daily_checkins
    WHERE user_id = :userId
    ORDER BY checkin_date DESC, id DESC
    LIMIT 1
    `,
    { userId }
  );

  return rows[0] || null;
}

async function getTodayCheckin(userId) {
  const today = getTodayDate();

  const rows = await query(
    `
    SELECT *
    FROM daily_checkins
    WHERE user_id = :userId
      AND checkin_date = :today
    LIMIT 1
    `,
    { userId, today }
  );

  return rows[0] || null;
}

async function getMyCheckinStatus(userId) {
  const today = getTodayDate();
  const latest = await getLatestCheckin(userId);
  const todayCheckin = await getTodayCheckin(userId);

  return {
    today,
    checked_in_today: !!todayCheckin,
    current_streak: latest ? Number(latest.streak_count) : 0,
    last_checkin_date: latest ? latest.checkin_date : null,
    today_reward: todayCheckin
      ? {
          gold: todayCheckin.reward_gold,
          exp: todayCheckin.reward_exp,
        }
      : null,
  };
}

async function getMyCheckinHistory(userId) {
  const rows = await query(
    `
    SELECT
      id,
      checkin_date,
      streak_count,
      reward_gold,
      reward_exp,
      created_at
    FROM daily_checkins
    WHERE user_id = :userId
    ORDER BY checkin_date DESC, id DESC
    LIMIT 30
    `,
    { userId }
  );

  return {
    items: rows,
  };
}

async function checkinToday(userId) {
  const today = getTodayDate();
  const yesterday = getYesterdayDate();

  const existingToday = await getTodayCheckin(userId);
  if (existingToday) {
    throw new ApiError(400, 'Hôm nay bạn đã checkin rồi');
  }

  const latest = await getLatestCheckin(userId);

  let nextStreak = 1;
  if (latest) {
    if (String(latest.checkin_date) === yesterday) {
      nextStreak = Number(latest.streak_count) + 1;
    } else if (String(latest.checkin_date) === today) {
      throw new ApiError(400, 'Hôm nay bạn đã checkin rồi');
    } else {
      nextStreak = 1;
    }
  }

  const reward = calculateRewardByStreak(nextStreak);

  await query(
    `
    INSERT INTO daily_checkins (
      user_id,
      checkin_date,
      streak_count,
      reward_gold,
      reward_exp,
      created_at
    )
    VALUES (
      :userId,
      :today,
      :streakCount,
      :rewardGold,
      :rewardExp,
      NOW()
    )
    `,
    {
      userId,
      today,
      streakCount: nextStreak,
      rewardGold: reward.gold,
      rewardExp: reward.exp,
    }
  );

  const inserted = await query(
    `
    SELECT *
    FROM daily_checkins
    WHERE user_id = :userId
      AND checkin_date = :today
    ORDER BY id DESC
    LIMIT 1
    `,
    { userId, today }
  );

  return {
    message: 'Checkin thành công',
    checkin: inserted[0],
    reward,
    current_streak: nextStreak,
  };
}

module.exports = {
  getMyCheckinStatus,
  getMyCheckinHistory,
  checkinToday,
};