const { query } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

async function getUserBasic(userId) {
  const rows = await query(
    `
    SELECT id, username, email, display_name, avatar_url, status
    FROM users
    WHERE id = :userId
    LIMIT 1
    `,
    { userId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy user');
  }

  return rows[0];
}

async function getUserProfileRow(userId) {
  const rows = await query(
    `
    SELECT *
    FROM user_profiles
    WHERE user_id = :userId
    LIMIT 1
    `,
    { userId }
  );

  return rows[0] || null;
}

async function getMyProfile(userId) {
  const user = await getUserBasic(userId);
  const profile = await getUserProfileRow(userId);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      status: user.status,
    },
    profile: profile
      ? {
          bio: profile.bio || null,
          gender: profile.gender || null,
          birthday: profile.birthday || null,
          country: profile.country || null,
        }
      : null,
  };
}

async function updateMyProfile(userId, payload) {
  const user = await getUserBasic(userId);

  const displayName = payload.display_name?.trim?.() || null;
  const bio = payload.bio?.trim?.() || null;
  const avatarUrl = payload.avatar_url?.trim?.() || null;

  if (displayName && displayName.length > 100) {
    throw new ApiError(400, 'display_name không được vượt quá 100 ký tự');
  }

  if (bio && bio.length > 1000) {
    throw new ApiError(400, 'bio không được vượt quá 1000 ký tự');
  }

  if (avatarUrl && avatarUrl.length > 255) {
    throw new ApiError(400, 'avatar_url không được vượt quá 255 ký tự');
  }

  await query(
    `
    UPDATE users
    SET display_name = :displayName,
        avatar_url = :avatarUrl
    WHERE id = :userId
    `,
    {
      userId,
      displayName: displayName ?? user.display_name ?? null,
      avatarUrl: avatarUrl ?? user.avatar_url ?? null,
    }
  );

  const existingProfile = await getUserProfileRow(userId);

  if (existingProfile) {
    await query(
      `
      UPDATE user_profiles
      SET bio = :bio,
          updated_at = NOW()
      WHERE user_id = :userId
      `,
      {
        userId,
        bio: bio ?? existingProfile.bio ?? null,
      }
    );
  } else {
    await query(
      `
      INSERT INTO user_profiles (user_id, bio, created_at, updated_at)
      VALUES (:userId, :bio, NOW(), NOW())
      `,
      {
        userId,
        bio,
      }
    );
  }

  return getMyProfile(userId);
}

module.exports = {
  getMyProfile,
  updateMyProfile,
};