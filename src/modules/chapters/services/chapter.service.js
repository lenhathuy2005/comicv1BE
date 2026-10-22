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

async function getChapterDetail(chapterId) {
  const rows = await query(
    `SELECT ch.id, ch.comic_id, ch.chapter_number, ch.title, ch.slug, ch.access_type,
            ch.publish_status, ch.view_count, ch.released_at, ch.created_at,
            c.title AS comic_title, c.slug AS comic_slug
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

  return {
    ...rows[0],
    images,
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

module.exports = {
  listChaptersByComic,
  getChapterDetail,
  createChapter,
  updateChapter,
};