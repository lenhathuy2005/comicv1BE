const { query } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

function normalizePage(value, defaultValue = 1) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

function normalizeLimit(value, defaultValue = 20) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return defaultValue;
  return Math.min(parsed, 100);
}

function normalizeSort(sort) {
  if (sort === 'oldest') return 'ASC';
  return 'DESC';
}

async function ensureComicExists(comicId) {
  const rows = await query(
    `
    SELECT id
    FROM comics
    WHERE id = :comicId
      AND deleted_at IS NULL
    LIMIT 1
    `,
    { comicId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy comic');
  }

  return rows[0];
}

async function ensureChapterExists(chapterId) {
  const rows = await query(
    `
    SELECT id, comic_id
    FROM chapters
    WHERE id = :chapterId
      AND deleted_at IS NULL
    LIMIT 1
    `,
    { chapterId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy chapter');
  }

  return rows[0];
}

async function ensureCommentExists(commentId) {
  const rows = await query(
    `
    SELECT *
    FROM comments
    WHERE id = :commentId
    LIMIT 1
    `,
    { commentId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy comment');
  }

  return rows[0];
}

async function getRepliesByParentIds(parentIds = []) {
  if (!parentIds.length) return [];

  return query(
    `
    SELECT
      c.id,
      c.user_id,
      c.comic_id,
      c.chapter_id,
      c.parent_comment_id,
      c.content,
      c.comment_status,
      c.like_count,
      c.report_count,
      c.created_at,
      c.updated_at,
      u.username,
      u.display_name,
      u.avatar_url
    FROM comments c
    INNER JOIN users u ON u.id = c.user_id
    WHERE c.parent_comment_id IN (${parentIds.map(() => '?').join(',')})
      AND c.comment_status = 'visible'
    ORDER BY c.created_at ASC
    `,
    parentIds
  );
}

async function listComicComments({ comicId, page = 1, limit = 20, sort = 'newest' }) {
  if (!comicId || Number.isNaN(Number(comicId))) {
    throw new ApiError(400, 'comicId không hợp lệ');
  }

  await ensureComicExists(Number(comicId));

  page = normalizePage(page);
  limit = normalizeLimit(limit);
  const offset = (page - 1) * limit;
  const sortDirection = normalizeSort(sort);

  const totalRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM comments
    WHERE comic_id = :comicId
      AND parent_comment_id IS NULL
      AND comment_status = 'visible'
    `,
    { comicId }
  );

  const items = await query(
    `
    SELECT
      c.id,
      c.user_id,
      c.comic_id,
      c.chapter_id,
      c.parent_comment_id,
      c.content,
      c.comment_status,
      c.like_count,
      c.report_count,
      c.created_at,
      c.updated_at,
      u.username,
      u.display_name,
      u.avatar_url
    FROM comments c
    INNER JOIN users u ON u.id = c.user_id
    WHERE c.comic_id = :comicId
      AND c.parent_comment_id IS NULL
      AND c.comment_status = 'visible'
    ORDER BY c.created_at ${sortDirection}
    LIMIT :limit OFFSET :offset
    `,
    {
      comicId,
      limit,
      offset,
    }
  );

  const replies = await getRepliesByParentIds(items.map((item) => item.id));

  const mapped = items.map((item) => ({
    ...item,
    user: {
      id: item.user_id,
      username: item.username,
      display_name: item.display_name,
      avatar_url: item.avatar_url,
    },
    replies: replies
      .filter((reply) => reply.parent_comment_id === item.id)
      .map((reply) => ({
        ...reply,
        user: {
          id: reply.user_id,
          username: reply.username,
          display_name: reply.display_name,
          avatar_url: reply.avatar_url,
        },
      })),
  }));

  return {
    items: mapped,
    pagination: {
      page,
      limit,
      total: Number(totalRows[0]?.total || 0),
    },
  };
}

async function listChapterComments({ chapterId, page = 1, limit = 20, sort = 'newest' }) {
  if (!chapterId || Number.isNaN(Number(chapterId))) {
    throw new ApiError(400, 'chapterId không hợp lệ');
  }

  await ensureChapterExists(Number(chapterId));

  page = normalizePage(page);
  limit = normalizeLimit(limit);
  const offset = (page - 1) * limit;
  const sortDirection = normalizeSort(sort);

  const totalRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM comments
    WHERE chapter_id = :chapterId
      AND parent_comment_id IS NULL
      AND comment_status = 'visible'
    `,
    { chapterId }
  );

  const items = await query(
    `
    SELECT
      c.id,
      c.user_id,
      c.comic_id,
      c.chapter_id,
      c.parent_comment_id,
      c.content,
      c.comment_status,
      c.like_count,
      c.report_count,
      c.created_at,
      c.updated_at,
      u.username,
      u.display_name,
      u.avatar_url
    FROM comments c
    INNER JOIN users u ON u.id = c.user_id
    WHERE c.chapter_id = :chapterId
      AND c.parent_comment_id IS NULL
      AND c.comment_status = 'visible'
    ORDER BY c.created_at ${sortDirection}
    LIMIT :limit OFFSET :offset
    `,
    {
      chapterId,
      limit,
      offset,
    }
  );

  const replies = await getRepliesByParentIds(items.map((item) => item.id));

  const mapped = items.map((item) => ({
    ...item,
    user: {
      id: item.user_id,
      username: item.username,
      display_name: item.display_name,
      avatar_url: item.avatar_url,
    },
    replies: replies
      .filter((reply) => reply.parent_comment_id === item.id)
      .map((reply) => ({
        ...reply,
        user: {
          id: reply.user_id,
          username: reply.username,
          display_name: reply.display_name,
          avatar_url: reply.avatar_url,
        },
      })),
  }));

  return {
    items: mapped,
    pagination: {
      page,
      limit,
      total: Number(totalRows[0]?.total || 0),
    },
  };
}

async function listMyComments({ userId, page = 1, limit = 20 }) {
  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  page = normalizePage(page);
  limit = normalizeLimit(limit);
  const offset = (page - 1) * limit;

  const totalRows = await query(
    `
    SELECT COUNT(*) AS total
    FROM comments
    WHERE user_id = :userId
    `,
    { userId }
  );

  const items = await query(
    `
    SELECT
      c.id,
      c.user_id,
      c.comic_id,
      c.chapter_id,
      c.parent_comment_id,
      c.content,
      c.comment_status,
      c.like_count,
      c.report_count,
      c.created_at,
      c.updated_at,
      cm.title AS comic_title,
      ch.title AS chapter_title
    FROM comments c
    LEFT JOIN comics cm ON cm.id = c.comic_id
    LEFT JOIN chapters ch ON ch.id = c.chapter_id
    WHERE c.user_id = :userId
    ORDER BY c.id DESC
    LIMIT :limit OFFSET :offset
    `,
    {
      userId,
      limit,
      offset,
    }
  );

  return {
    items,
    pagination: {
      page,
      limit,
      total: Number(totalRows[0]?.total || 0),
    },
  };
}

async function createComment({ userId, comicId, chapterId, parentCommentId = null, content }) {
  if (!userId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const trimmedContent = String(content || '').trim();
  if (!trimmedContent) {
    throw new ApiError(400, 'Nội dung comment không được để trống');
  }

  if (trimmedContent.length > 1000) {
    throw new ApiError(400, 'Nội dung comment không được vượt quá 1000 ký tự');
  }

  comicId = comicId ? Number(comicId) : null;
  chapterId = chapterId ? Number(chapterId) : null;
  parentCommentId = parentCommentId ? Number(parentCommentId) : null;

  if (!comicId && !chapterId) {
    throw new ApiError(400, 'Phải truyền comic_id hoặc chapter_id');
  }

  let chapter = null;
  if (chapterId) {
    chapter = await ensureChapterExists(chapterId);
  }

  if (comicId) {
    await ensureComicExists(comicId);
  }

  if (chapter && comicId && Number(chapter.comic_id) !== Number(comicId)) {
    throw new ApiError(400, 'chapter_id không thuộc comic_id đã truyền');
  }

  if (!comicId && chapter) {
    comicId = Number(chapter.comic_id);
  }

  if (parentCommentId) {
    const parent = await ensureCommentExists(parentCommentId);

    if (parent.comment_status === 'deleted') {
      throw new ApiError(400, 'Không thể reply vào comment đã xóa');
    }

    if (Number(parent.comic_id || 0) !== Number(comicId || 0)) {
      throw new ApiError(400, 'parent_comment_id không cùng comic');
    }

    if (Number(parent.chapter_id || 0) !== Number(chapterId || 0)) {
      throw new ApiError(400, 'parent_comment_id không cùng chapter');
    }

    if (parent.parent_comment_id) {
      throw new ApiError(400, 'Hiện tại chỉ hỗ trợ reply 1 tầng');
    }
  }

  await query(
    `
    INSERT INTO comments (
      user_id,
      comic_id,
      chapter_id,
      parent_comment_id,
      content,
      comment_status,
      like_count,
      report_count,
      created_at,
      updated_at
    )
    VALUES (
      :userId,
      :comicId,
      :chapterId,
      :parentCommentId,
      :content,
      'visible',
      0,
      0,
      NOW(),
      NOW()
    )
    `,
    {
      userId,
      comicId,
      chapterId,
      parentCommentId,
      content: trimmedContent,
    }
  );

  const createdRows = await query(
    `
    SELECT
      c.id,
      c.user_id,
      c.comic_id,
      c.chapter_id,
      c.parent_comment_id,
      c.content,
      c.comment_status,
      c.like_count,
      c.report_count,
      c.created_at,
      c.updated_at,
      u.username,
      u.display_name,
      u.avatar_url
    FROM comments c
    INNER JOIN users u ON u.id = c.user_id
    WHERE c.id = LAST_INSERT_ID()
    LIMIT 1
    `
  );

  return createdRows[0];
}

async function updateMyComment({ commentId, userId, content }) {
  if (!commentId || Number.isNaN(Number(commentId))) {
    throw new ApiError(400, 'commentId không hợp lệ');
  }

  const trimmedContent = String(content || '').trim();
  if (!trimmedContent) {
    throw new ApiError(400, 'Nội dung comment không được để trống');
  }

  if (trimmedContent.length > 1000) {
    throw new ApiError(400, 'Nội dung comment không được vượt quá 1000 ký tự');
  }

  const existing = await ensureCommentExists(commentId);

  if (Number(existing.user_id) !== Number(userId)) {
    throw new ApiError(403, 'Bạn không có quyền sửa comment này');
  }

  if (existing.comment_status !== 'visible') {
    throw new ApiError(400, 'Comment này không thể chỉnh sửa');
  }

  await query(
    `
    UPDATE comments
    SET content = :content,
        updated_at = NOW()
    WHERE id = :commentId
    `,
    {
      content: trimmedContent,
      commentId,
    }
  );

  const rows = await query(
    `
    SELECT *
    FROM comments
    WHERE id = :commentId
    LIMIT 1
    `,
    { commentId }
  );

  return rows[0];
}

async function deleteMyComment({ commentId, userId }) {
  if (!commentId || Number.isNaN(Number(commentId))) {
    throw new ApiError(400, 'commentId không hợp lệ');
  }

  const existing = await ensureCommentExists(commentId);

  if (Number(existing.user_id) !== Number(userId)) {
    throw new ApiError(403, 'Bạn không có quyền xóa comment này');
  }

  await query(
    `
    UPDATE comments
    SET comment_status = 'deleted',
        content = '[Đã xóa]',
        updated_at = NOW()
    WHERE id = :commentId
    `,
    { commentId }
  );

  const rows = await query(
    `
    SELECT *
    FROM comments
    WHERE id = :commentId
    LIMIT 1
    `,
    { commentId }
  );

  return rows[0];
}

module.exports = {
  listComicComments,
  listChapterComments,
  listMyComments,
  createComment,
  updateMyComment,
  deleteMyComment,
};