const { query, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

async function listChaptersByComic(comicId) {
  const rows = await query(
    `SELECT id, comic_id, chapter_number, title, slug, access_type, publish_status, view_count, released_at, created_at
     FROM chapters
     WHERE comic_id = :comicId
       AND deleted_at IS NULL
     ORDER BY chapter_number DESC`,
    { comicId }
  );

  return rows;
}

async function getChapterDetail(chapterId, currentUserId = null) {
  const rows = await query(
    `SELECT ch.id, ch.comic_id, ch.chapter_number, ch.title, ch.slug, ch.access_type,
            ch.publish_status, ch.view_count, ch.released_at, ch.created_at,
            c.title AS comic_title, c.slug AS comic_slug,
            (SELECT COUNT(*) FROM chapter_images ci WHERE ci.chapter_id = ch.id) AS total_pages
     FROM chapters ch
     JOIN comics c ON c.id = ch.comic_id
     WHERE ch.id = :chapterId
       AND ch.deleted_at IS NULL
       AND c.deleted_at IS NULL
     LIMIT 1`,
    { chapterId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Chapter not found');
  }

  const images = await query(
    `SELECT id, image_url, display_order
     FROM chapter_images
     WHERE chapter_id = :chapterId
     ORDER BY display_order ASC`,
    { chapterId }
  );

  let readingProgress = null;
  if (currentUserId) {
    const progressRows = await query(
      `SELECT id, last_page_number, progress_percent, last_read_at
       FROM reading_history
       WHERE user_id = :userId AND chapter_id = :chapterId
       LIMIT 1`,
      { userId: currentUserId, chapterId }
    );
    readingProgress = progressRows[0] || null;
  }

  return {
    ...rows[0],
    total_pages: Number(rows[0].total_pages || images.length || 0),
    images,
    reading_progress: readingProgress,
  };
}

async function createChapter(payload) {
  return transaction(async (conn) => {
    const [comicRows] = await conn.execute(
      `SELECT id FROM comics WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [payload.comicId]
    );

    if (!comicRows.length) {
      throw new ApiError(404, 'Comic not found');
    }

    const [result] = await conn.execute(
      `INSERT INTO chapters
       (comic_id, chapter_number, title, slug, access_type, publish_status, released_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        payload.comicId,
        payload.chapterNumber,
        payload.title,
        payload.slug,
        payload.accessType || 'free',
        payload.publishStatus || 'draft',
        payload.releasedAt || null,
      ]
    );

    const chapterId = result.insertId;

    if (Array.isArray(payload.images) && payload.images.length) {
      const values = payload.images.map((img, index) => [
        chapterId,
        img.imageUrl,
        img.displayOrder ?? index + 1,
      ]);

      await conn.query(
        `INSERT INTO chapter_images (chapter_id, image_url, display_order) VALUES ?`,
        [values]
      );
    }

    return { id: chapterId };
  });
}

async function updateChapter(chapterId, payload) {
  return transaction(async (conn) => {
    const [result] = await conn.execute(
      `UPDATE chapters
       SET chapter_number = ?, title = ?, slug = ?, access_type = ?, publish_status = ?, released_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [
        payload.chapterNumber,
        payload.title,
        payload.slug,
        payload.accessType || 'free',
        payload.publishStatus || 'draft',
        payload.releasedAt || null,
        chapterId,
      ]
    );

    if (!result.affectedRows) {
      throw new ApiError(404, 'Chapter not found');
    }

    if (Array.isArray(payload.images)) {
      await conn.execute(`DELETE FROM chapter_images WHERE chapter_id = ?`, [chapterId]);

      if (payload.images.length) {
        const values = payload.images.map((img, index) => [
          chapterId,
          img.imageUrl,
          img.displayOrder ?? index + 1,
        ]);

        await conn.query(
          `INSERT INTO chapter_images (chapter_id, image_url, display_order) VALUES ?`,
          [values]
        );
      }
    }

    return { id: Number(chapterId) };
  });
}


async function markReadChapterMissions(conn, userId) {
  const [missions] = await conn.execute(
    `SELECT id, target_value, mission_type
     FROM missions
     WHERE is_active = 1
       AND target_type = 'read_chapter'
       AND (start_at IS NULL OR start_at <= NOW())
       AND (end_at IS NULL OR end_at >= NOW())`
  );

  for (const mission of missions) {
    const targetValue = Math.max(1, Number(mission.target_value || 1));
    const missionType = String(mission.mission_type || '').toLowerCase();

    const existingSql = missionType === 'daily' || missionType === 'weekly'
      ? `SELECT id, progress_value, mission_status
         FROM user_missions
         WHERE user_id = ?
           AND mission_id = ?
           AND assigned_date = CURDATE()
         ORDER BY id DESC
         LIMIT 1`
      : `SELECT id, progress_value, mission_status
         FROM user_missions
         WHERE user_id = ?
           AND mission_id = ?
         ORDER BY id DESC
         LIMIT 1`;

    const [existingRows] = await conn.execute(existingSql, [userId, mission.id]);

    if (!existingRows.length) {
      const nextStatus = targetValue <= 1 ? 'completed' : 'in_progress';
      await conn.execute(
        `INSERT INTO user_missions (
           user_id,
           mission_id,
           progress_value,
           mission_status,
           assigned_date,
           completed_at,
           created_at,
           updated_at
         ) VALUES (?, ?, 1, ?, CURDATE(), IF(? = 'completed', NOW(), NULL), NOW(), NOW())`,
        [userId, mission.id, nextStatus, nextStatus]
      );
      continue;
    }

    const current = existingRows[0];
    if (current.mission_status !== 'in_progress') continue;

    const nextProgress = Math.max(Number(current.progress_value || 0), 1);
    const nextStatus = nextProgress >= targetValue ? 'completed' : 'in_progress';

    await conn.execute(
      `UPDATE user_missions
       SET progress_value = ?,
           mission_status = ?,
           completed_at = IF(? = 'completed', COALESCE(completed_at, NOW()), completed_at),
           updated_at = NOW()
       WHERE id = ?`,
      [nextProgress, nextStatus, nextStatus, current.id]
    );
  }
}

async function saveReadingProgress({ userId, chapterId, lastPageNumber = 1, progressPercent = null }) {
  if (!userId) throw new ApiError(401, 'Không xác định được người dùng hiện tại');

  return transaction(async (conn) => {
    const [chapterRows] = await conn.execute(
      `SELECT ch.id, ch.comic_id,
              (SELECT COUNT(*) FROM chapter_images ci WHERE ci.chapter_id = ch.id) AS total_pages
       FROM chapters ch
       WHERE ch.id = ? AND ch.deleted_at IS NULL
       LIMIT 1`,
      [chapterId]
    );

    if (!chapterRows.length) throw new ApiError(404, 'Chapter not found');

    const chapter = chapterRows[0];
    const totalPages = Number(chapter.total_pages || 0);
    const finalLastPage = Math.max(1, Number(lastPageNumber || 1));
    const computedPercent = totalPages > 0 ? Math.min((finalLastPage / totalPages) * 100, 100) : 0;
    const finalProgressPercent = progressPercent == null ? computedPercent : Math.max(0, Math.min(Number(progressPercent), 100));

    const [existingRows] = await conn.execute(
      `SELECT id FROM reading_history WHERE user_id = ? AND comic_id = ? LIMIT 1`,
      [userId, chapter.comic_id]
    );

    if (existingRows.length) {
      await conn.execute(
        `UPDATE reading_history
         SET chapter_id = ?,
             last_page_number = ?,
             progress_percent = ?,
             last_read_at = NOW()
         WHERE id = ?`,
        [chapterId, finalLastPage, finalProgressPercent, existingRows[0].id]
      );
    } else {
      await conn.execute(
        `INSERT INTO reading_history (user_id, comic_id, chapter_id, last_page_number, progress_percent, last_read_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [userId, chapter.comic_id, chapterId, finalLastPage, finalProgressPercent]
      );
    }

    await conn.execute(`UPDATE chapters SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?`, [chapterId]);
    await conn.execute(`UPDATE comics SET total_views = COALESCE(total_views, 0) + 1 WHERE id = ?`, [chapter.comic_id]);

    await markReadChapterMissions(conn, userId);

    return {
      chapter_id: Number(chapterId),
      comic_id: Number(chapter.comic_id),
      last_page_number: finalLastPage,
      progress_percent: Number(finalProgressPercent.toFixed(2)),
      total_pages: totalPages,
    };
  });
}

module.exports = {
  listChaptersByComic,
  getChapterDetail,
  createChapter,
  updateChapter,
  saveReadingProgress,
};
