const { query, transaction } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

function buildComicSort(sort) {
  const value = String(sort || '').trim().toLowerCase();

  if (value === 'views' || value === 'view' || value === 'top_views') {
    return 'COALESCE(c.total_views, 0) DESC, COALESCE(c.total_follows, 0) DESC, c.id DESC';
  }

  if (value === 'follows' || value === 'follow' || value === 'top_follows') {
    return 'COALESCE(c.total_follows, 0) DESC, COALESCE(c.total_views, 0) DESC, c.id DESC';
  }

  if (value === 'chapters' || value === 'chapter') {
    return 'total_chapters DESC, COALESCE(c.total_views, 0) DESC, c.id DESC';
  }

  if (value === 'hot' || value === 'rank' || value === 'ranking') {
    return '(COALESCE(c.total_views, 0) + COALESCE(c.total_follows, 0) * 10) DESC, c.id DESC';
  }

  if (value === 'latest' || value === 'updated') {
    return 'c.updated_at DESC, c.id DESC';
  }

  return 'c.id DESC';
}

function buildComicSelect(orderBySql, limitSql = 'LIMIT :limit OFFSET :offset') {
  return `SELECT c.id, c.title, c.slug, c.cover_image_url, c.banner_image_url, c.summary,
            c.publication_status, c.visibility_status, c.age_rating, c.total_views, c.total_follows,
            c.created_at, c.updated_at,
            a.name AS author_name,
            COUNT(DISTINCT ch.id) AS total_chapters,
            GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR ', ') AS genres,
            MAX(CASE WHEN f.user_id = :currentUserId THEN 1 ELSE 0 END) AS is_following
     FROM comics c
     LEFT JOIN authors a ON a.id = c.author_id
     LEFT JOIN chapters ch ON ch.comic_id = c.id AND ch.deleted_at IS NULL
     LEFT JOIN comic_genres cg ON cg.comic_id = c.id
     LEFT JOIN genres g ON g.id = cg.genre_id
     LEFT JOIN follows f ON f.comic_id = c.id
     WHERE (:keyword IS NULL OR c.title LIKE CONCAT('%', :keyword, '%') OR c.slug LIKE CONCAT('%', :keyword, '%') OR a.name LIKE CONCAT('%', :keyword, '%'))
       AND (:publicationStatus IS NULL OR c.publication_status = :publicationStatus)
       AND (:genreId IS NULL OR EXISTS (
         SELECT 1
         FROM comic_genres cg_filter
         WHERE cg_filter.comic_id = c.id AND cg_filter.genre_id = :genreId
       ))
       AND (:genreSlug IS NULL OR EXISTS (
         SELECT 1
         FROM comic_genres cg_filter
         JOIN genres g_filter ON g_filter.id = cg_filter.genre_id
         WHERE cg_filter.comic_id = c.id AND g_filter.slug = :genreSlug
       ))
       AND c.deleted_at IS NULL
     GROUP BY c.id
     ORDER BY ${orderBySql}
     ${limitSql}`;
}

function mapComicRows(rows) {
  return rows.map((row) => ({
    ...row,
    total_chapters: Number(row.total_chapters || 0),
    total_views: Number(row.total_views || 0),
    total_follows: Number(row.total_follows || 0),
    is_following: Boolean(Number(row.is_following || 0)),
  }));
}

async function listGenres() {
  return query(
    `SELECT
       g.id,
       g.name,
       g.slug,
       g.description,
       COUNT(DISTINCT c.id) AS comic_count
     FROM genres g
     LEFT JOIN comic_genres cg ON cg.genre_id = g.id
     LEFT JOIN comics c ON c.id = cg.comic_id AND c.deleted_at IS NULL
     GROUP BY g.id
     ORDER BY comic_count DESC, g.name ASC`
  );
}

async function listComics(filters, currentUserId = null) {
  const page = Number(filters.page || 1);
  const limit = Math.min(Math.max(Number(filters.limit || 20), 1), 100);
  const offset = (page - 1) * limit;
  const orderBySql = buildComicSort(filters.sort || filters.orderBy);

  const rows = await query(
    buildComicSelect(orderBySql),
    {
      keyword: filters.keyword || filters.q || null,
      publicationStatus: filters.publicationStatus || filters.publication_status || null,
      genreId: filters.genreId || filters.genre_id || null,
      genreSlug: filters.genreSlug || filters.genre_slug || filters.genre || null,
      currentUserId: currentUserId || 0,
      limit,
      offset,
    }
  );

  return { page, limit, items: mapComicRows(rows) };
}

async function listComicRankings(filters, currentUserId = null) {
  const limit = Math.min(Math.max(Number(filters.limit || 20), 1), 100);
  const orderBySql = buildComicSort(filters.sort || 'hot');

  const rows = await query(
    buildComicSelect(orderBySql, 'LIMIT :limit'),
    {
      keyword: filters.keyword || filters.q || null,
      publicationStatus: filters.publicationStatus || filters.publication_status || null,
      genreId: filters.genreId || filters.genre_id || null,
      genreSlug: filters.genreSlug || filters.genre_slug || filters.genre || null,
      currentUserId: currentUserId || 0,
      limit,
      offset: 0,
    }
  );

  const normalizedSort = String(filters.sort || 'hot').trim().toLowerCase();

  return {
    sort: normalizedSort,
    limit,
    items: mapComicRows(rows).map((comic, index) => {
      const totalViews = Number(comic.total_views || 0);
      const totalFollows = Number(comic.total_follows || 0);
      let scoreValue = totalViews + totalFollows * 10;

      if (normalizedSort === 'views' || normalizedSort === 'view' || normalizedSort === 'top_views') {
        scoreValue = totalViews;
      }

      if (normalizedSort === 'follows' || normalizedSort === 'follow' || normalizedSort === 'top_follows') {
        scoreValue = totalFollows;
      }

      return {
        ...comic,
        rank: index + 1,
        score_value: scoreValue,
      };
    }),
  };
}

async function getComicDetail(comicId, currentUserId = null) {
  const rows = await query(
    `SELECT c.*, a.name AS author_name,
            GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR ', ') AS genres,
            MAX(CASE WHEN f.user_id = :currentUserId THEN 1 ELSE 0 END) AS is_following
     FROM comics c
     LEFT JOIN authors a ON a.id = c.author_id
     LEFT JOIN comic_genres cg ON cg.comic_id = c.id
     LEFT JOIN genres g ON g.id = cg.genre_id
     LEFT JOIN follows f ON f.comic_id = c.id
     WHERE c.id = :comicId AND c.deleted_at IS NULL
     GROUP BY c.id
     LIMIT 1`,
    { comicId, currentUserId: currentUserId || 0 }
  );
  if (!rows.length) throw new ApiError(404, 'Comic not found');

  const chapters = await query(
    `SELECT id, chapter_number, title, slug, access_type, publish_status, view_count, released_at
     FROM chapters
     WHERE comic_id = :comicId AND deleted_at IS NULL
     ORDER BY chapter_number DESC`,
    { comicId }
  );

  return { ...rows[0], is_following: Boolean(Number(rows[0].is_following || 0)), chapters };
}

async function createComic(payload, actorUserId) {
  return transaction(async (conn) => {
    const [result] = await conn.execute(
      `INSERT INTO comics (author_id, title, slug, cover_image_url, banner_image_url, summary, publication_status, visibility_status, age_rating, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.authorId || null,
        payload.title,
        payload.slug,
        payload.coverImageUrl || null,
        payload.bannerImageUrl || null,
        payload.summary || null,
        payload.publicationStatus || 'draft',
        payload.visibilityStatus || 'public',
        payload.ageRating || 'all',
        actorUserId || null,
      ]
    );

    if (Array.isArray(payload.genreIds) && payload.genreIds.length) {
      const values = payload.genreIds.map((genreId) => [result.insertId, genreId]);
      await conn.query('INSERT INTO comic_genres (comic_id, genre_id) VALUES ?', [values]);
    }

    return { id: result.insertId };
  });
}

async function updateComic(comicId, payload) {
  return transaction(async (conn) => {
    await conn.execute(
      `UPDATE comics
       SET author_id = ?, title = ?, slug = ?, cover_image_url = ?, banner_image_url = ?, summary = ?,
           publication_status = ?, visibility_status = ?, age_rating = ?
       WHERE id = ?`,
      [
        payload.authorId || null,
        payload.title,
        payload.slug,
        payload.coverImageUrl || null,
        payload.bannerImageUrl || null,
        payload.summary || null,
        payload.publicationStatus || 'draft',
        payload.visibilityStatus || 'public',
        payload.ageRating || 'all',
        comicId,
      ]
    );

    if (Array.isArray(payload.genreIds)) {
      await conn.execute('DELETE FROM comic_genres WHERE comic_id = ?', [comicId]);
      if (payload.genreIds.length) {
        const values = payload.genreIds.map((genreId) => [comicId, genreId]);
        await conn.query('INSERT INTO comic_genres (comic_id, genre_id) VALUES ?', [values]);
      }
    }
    return { id: Number(comicId) };
  });
}

async function followComic(comicId, userId) {
  return transaction(async (conn) => {
    const [comicRows] = await conn.execute(`SELECT id, total_follows FROM comics WHERE id = ? AND deleted_at IS NULL LIMIT 1`, [comicId]);
    if (!comicRows.length) throw new ApiError(404, 'Comic not found');

    const [existing] = await conn.execute(`SELECT id FROM follows WHERE user_id = ? AND comic_id = ? LIMIT 1`, [userId, comicId]);
    if (existing.length) {
      return { comic_id: Number(comicId), is_following: true, total_follows: Number(comicRows[0].total_follows || 0) };
    }

    await conn.execute(`INSERT INTO follows (user_id, comic_id, created_at) VALUES (?, ?, NOW())`, [userId, comicId]);
    await conn.execute(`UPDATE comics SET total_follows = COALESCE(total_follows, 0) + 1, updated_at = NOW() WHERE id = ?`, [comicId]);

    const [updatedRows] = await conn.execute(`SELECT total_follows FROM comics WHERE id = ? LIMIT 1`, [comicId]);
    return { comic_id: Number(comicId), is_following: true, total_follows: Number(updatedRows[0]?.total_follows || 0) };
  });
}

async function unfollowComic(comicId, userId) {
  return transaction(async (conn) => {
    const [comicRows] = await conn.execute(`SELECT id, total_follows FROM comics WHERE id = ? AND deleted_at IS NULL LIMIT 1`, [comicId]);
    if (!comicRows.length) throw new ApiError(404, 'Comic not found');

    const [existing] = await conn.execute(`SELECT id FROM follows WHERE user_id = ? AND comic_id = ? LIMIT 1`, [userId, comicId]);
    if (!existing.length) {
      return { comic_id: Number(comicId), is_following: false, total_follows: Number(comicRows[0].total_follows || 0) };
    }

    await conn.execute(`DELETE FROM follows WHERE id = ?`, [existing[0].id]);
    await conn.execute(`UPDATE comics SET total_follows = GREATEST(COALESCE(total_follows, 0) - 1, 0), updated_at = NOW() WHERE id = ?`, [comicId]);
    const [updatedRows] = await conn.execute(`SELECT total_follows FROM comics WHERE id = ? LIMIT 1`, [comicId]);

    return { comic_id: Number(comicId), is_following: false, total_follows: Number(updatedRows[0]?.total_follows || 0) };
  });
}

async function listChapterImages(chapterId) {
  return query(
    `SELECT id, image_url, display_order
     FROM chapter_images
     WHERE chapter_id = :chapterId
     ORDER BY display_order ASC`,
    { chapterId }
  );
}

module.exports = {
  listGenres,
  listComics,
  listComicRankings,
  getComicDetail,
  createComic,
  updateComic,
  followComic,
  unfollowComic,
  listChapterImages,
};
