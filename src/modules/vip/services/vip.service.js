const { query } = require('../../../config/database');

async function listVipLevels() {
  const levels = await query('SELECT * FROM vip_levels ORDER BY level_number ASC');
  for (const level of levels) {
    level.benefits = await query(
      'SELECT benefit_code, benefit_name, benefit_value, description FROM vip_benefits WHERE vip_level_id = :vipLevelId',
      { vipLevelId: level.id }
    );
  }
  return levels;
}

async function myVip(userId) {
  const rows = await query(
    `SELECT uv.*, vl.level_number, vl.name, vl.required_topup_amount, vl.badge_name, vl.badge_color, vl.description
     FROM user_vip uv
     JOIN vip_levels vl ON vl.id = uv.current_vip_level_id
     WHERE uv.user_id = :userId
     LIMIT 1`,
    { userId }
  );
  return rows[0] || null;
}

async function listFeatureUnlocks() {
  return query(
    `SELECT vfu.*, vl.level_number, vl.name AS vip_level_name
     FROM vip_feature_unlocks vfu
     JOIN vip_levels vl ON vl.id = vfu.required_vip_level_id
     ORDER BY vl.level_number ASC, vfu.feature_code ASC`
  );
}

module.exports = { listVipLevels, myVip, listFeatureUnlocks };
