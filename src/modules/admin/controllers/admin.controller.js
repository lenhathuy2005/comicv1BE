const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const service = require('../services/admin.service');

const ok = (res, data, message = 'Thành công', status = 200) =>
  ApiResponse.success(res, data, message, status);

function parseJsonArray(value, fallback = []) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeComicPayload(req) {
  const coverImage = req.file;

  const payload = {
    author_id: req.body.author_id ? Number(req.body.author_id) : null,
    title: req.body.title || '',
    slug: req.body.slug || '',
    summary: req.body.summary || null,
    publication_status: req.body.publication_status || 'draft',
    visibility_status: req.body.visibility_status || 'public',
    age_rating: req.body.age_rating || 'all',
    genre_ids: parseJsonArray(req.body.genre_ids).map(Number).filter(Boolean),
  };

  if (coverImage) {
    payload.cover_image_url = `/uploads/comics/${coverImage.filename}`;
    payload.banner_image_url = payload.cover_image_url;
  }

  return payload;
}

function normalizeChapterPayload(req) {
  const payload = {
    comic_id: req.body.comic_id ? Number(req.body.comic_id) : null,
    chapter_number: req.body.chapter_number ? Number(req.body.chapter_number) : null,
    title: req.body.title || null,
    slug: req.body.slug || '',
    summary: req.body.summary || null,
    access_type: req.body.access_type || 'free',
    publish_status: req.body.publish_status || 'draft',
    released_at: req.body.released_at || null,
  };

  if (Array.isArray(req.files) && req.files.length > 0) {
    payload.images = req.files.map((file, index) => ({
      image_url: `/uploads/chapters/${file.filename}`,
      display_order: index + 1,
    }));
  }

  return payload;
}

function normalizeNewChapterImages(req, startOrder = 1) {
  if (!Array.isArray(req.files) || req.files.length === 0) return [];
  return req.files.map((file, index) => ({
    image_url: `/uploads/chapters/${file.filename}`,
    display_order: startOrder + index,
  }));
}

exports.dashboard = asyncHandler(async (req, res) =>
  ok(res, await service.getDashboard(), 'Lấy dashboard admin thành công')
);

exports.listGenres = asyncHandler(async (req, res) =>
  ok(res, await service.listGenres(req.query), 'Lấy thể loại thành công')
);
exports.createGenre = asyncHandler(async (req, res) =>
  ok(res, await service.createGenre(req.body), 'Tạo thể loại thành công', 201)
);
exports.updateGenre = asyncHandler(async (req, res) =>
  ok(res, await service.updateGenre(Number(req.params.id), req.body), 'Cập nhật thể loại thành công')
);
exports.deleteGenre = asyncHandler(async (req, res) =>
  ok(res, await service.deleteGenre(Number(req.params.id)), 'Xóa thể loại thành công')
);

exports.listComments = asyncHandler(async (req, res) =>
  ok(res, await service.listComments(req.query), 'Lấy bình luận thành công')
);
exports.updateCommentStatus = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.updateCommentStatus(Number(req.params.id), req.body.comment_status),
    'Cập nhật trạng thái bình luận thành công'
  )
);
exports.deleteComment = asyncHandler(async (req, res) =>
  ok(res, await service.deleteComment(Number(req.params.id)), 'Xóa bình luận thành công')
);

exports.listUsers = asyncHandler(async (req, res) =>
  ok(res, await service.listUsersAdmin(req.query), 'Lấy users admin thành công')
);
exports.getUserDetail = asyncHandler(async (req, res) =>
  ok(res, await service.getUserAdminDetail(Number(req.params.id)), 'Lấy chi tiết user thành công')
);
exports.createUser = asyncHandler(async (req, res) =>
  ok(res, await service.createUserAdmin(req.body), 'Tạo user thành công', 201)
);
exports.updateUser = asyncHandler(async (req, res) =>
  ok(res, await service.updateUserAdmin(Number(req.params.id), req.body), 'Cập nhật user thành công')
);
exports.deleteUser = asyncHandler(async (req, res) =>
  ok(res, await service.deleteUserAdmin(Number(req.params.id)), 'Xóa user thành công')
);

exports.listGuilds = asyncHandler(async (req, res) =>
  ok(res, await service.listGuildsAdmin(req.query), 'Lấy guilds admin thành công')
);
exports.createGuild = asyncHandler(async (req, res) =>
  ok(res, await service.createGuildAdmin(req.user?.id, req.body), 'Tạo bang phái thành công', 201)
);
exports.updateGuild = asyncHandler(async (req, res) =>
  ok(res, await service.updateGuildAdmin(Number(req.params.id), req.body), 'Cập nhật bang phái thành công')
);
exports.deleteGuild = asyncHandler(async (req, res) =>
  ok(res, await service.deleteGuildAdmin(Number(req.params.id)), 'Xóa bang phái thành công')
);
exports.createGuildRole = asyncHandler(async (req, res) =>
  ok(res, await service.createGuildRoleAdmin(req.body), 'Tạo chức vụ bang thành công', 201)
);
exports.updateGuildRole = asyncHandler(async (req, res) =>
  ok(res, await service.updateGuildRoleAdmin(Number(req.params.id), req.body), 'Cập nhật chức vụ bang thành công')
);
exports.deleteGuildRole = asyncHandler(async (req, res) =>
  ok(res, await service.deleteGuildRoleAdmin(Number(req.params.id)), 'Xóa chức vụ bang thành công')
);
exports.approveGuildRequest = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.reviewGuildJoinRequestAdmin(Number(req.params.id), req.user?.id, 'approved'),
    'Duyệt yêu cầu gia nhập thành công'
  )
);
exports.rejectGuildRequest = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.reviewGuildJoinRequestAdmin(Number(req.params.id), req.user?.id, 'rejected'),
    'Từ chối yêu cầu gia nhập thành công'
  )
);

exports.listCultivation = asyncHandler(async (req, res) =>
  ok(res, await service.listCultivationAdmin(), 'Lấy dữ liệu tu luyện thành công')
);
exports.createRealm = asyncHandler(async (req, res) =>
  ok(res, await service.createRealm(req.body), 'Tạo cảnh giới thành công', 201)
);
exports.updateRealm = asyncHandler(async (req, res) =>
  ok(res, await service.updateRealm(Number(req.params.id), req.body), 'Cập nhật cảnh giới thành công')
);
exports.deleteRealm = asyncHandler(async (req, res) =>
  ok(res, await service.deleteRealm(Number(req.params.id)), 'Xóa cảnh giới thành công')
);
exports.createLevel = asyncHandler(async (req, res) =>
  ok(res, await service.createLevel(req.body), 'Tạo level thành công', 201)
);
exports.updateLevel = asyncHandler(async (req, res) =>
  ok(res, await service.updateLevel(Number(req.params.id), req.body), 'Cập nhật level thành công')
);
exports.deleteLevel = asyncHandler(async (req, res) =>
  ok(res, await service.deleteLevel(Number(req.params.id)), 'Xóa level thành công')
);

exports.listMissions = asyncHandler(async (req, res) =>
  ok(res, await service.listMissionsAdmin(req.query), 'Lấy nhiệm vụ thành công')
);
exports.createMission = asyncHandler(async (req, res) =>
  ok(res, await service.createMission(req.body), 'Tạo nhiệm vụ thành công', 201)
);
exports.updateMission = asyncHandler(async (req, res) =>
  ok(res, await service.updateMission(Number(req.params.id), req.body), 'Cập nhật nhiệm vụ thành công')
);
exports.deleteMission = asyncHandler(async (req, res) =>
  ok(res, await service.deleteMission(Number(req.params.id)), 'Xóa nhiệm vụ thành công')
);

exports.listAfk = asyncHandler(async (req, res) =>
  ok(res, await service.listAfkAdmin(), 'Lấy dữ liệu AFK thành công')
);
exports.createAfkConfig = asyncHandler(async (req, res) =>
  ok(res, await service.createAfkConfig(req.body), 'Tạo cấu hình AFK thành công', 201)
);
exports.updateAfkConfig = asyncHandler(async (req, res) =>
  ok(res, await service.updateAfkConfig(Number(req.params.id), req.body), 'Cập nhật cấu hình AFK thành công')
);
exports.deleteAfkConfig = asyncHandler(async (req, res) =>
  ok(res, await service.deleteAfkConfig(Number(req.params.id)), 'Xóa cấu hình AFK thành công')
);

exports.listVip = asyncHandler(async (req, res) =>
  ok(res, await service.listVipAdmin(), 'Lấy dữ liệu VIP thành công')
);
exports.createVipLevel = asyncHandler(async (req, res) =>
  ok(res, await service.createVipLevel(req.body), 'Tạo VIP level thành công', 201)
);
exports.updateVipLevel = asyncHandler(async (req, res) =>
  ok(res, await service.updateVipLevel(Number(req.params.id), req.body), 'Cập nhật VIP level thành công')
);
exports.deleteVipLevel = asyncHandler(async (req, res) =>
  ok(res, await service.deleteVipLevel(Number(req.params.id)), 'Xóa VIP level thành công')
);
exports.createVipBenefit = asyncHandler(async (req, res) =>
  ok(res, await service.createVipBenefit(req.body), 'Tạo quyền lợi VIP thành công', 201)
);
exports.updateVipBenefit = asyncHandler(async (req, res) =>
  ok(res, await service.updateVipBenefit(Number(req.params.id), req.body), 'Cập nhật quyền lợi VIP thành công')
);
exports.deleteVipBenefit = asyncHandler(async (req, res) =>
  ok(res, await service.deleteVipBenefit(Number(req.params.id)), 'Xóa quyền lợi VIP thành công')
);

exports.getRankingOverview = asyncHandler(async (req, res) =>
  ok(res, await service.getRankingOverview(), 'Lấy tổng quan ranking thành công')
);
exports.getRankingList = asyncHandler(async (req, res) =>
  ok(res, await service.getRankingList(req.params.type, req.query), 'Lấy bảng xếp hạng thành công')
);
exports.createRankingSnapshot = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.createRankingSnapshot(req.params.type, req.user?.id, req.body),
    'Tạo snapshot ranking thành công',
    201
  )
);

exports.listAuthors = asyncHandler(async (req, res) =>
  ok(res, await service.listAuthors(), 'Lấy authors thành công')
);
exports.listComics = asyncHandler(async (req, res) =>
  ok(res, await service.listComicsAdmin(req.query), 'Lấy comics admin thành công')
);
exports.createComic = asyncHandler(async (req, res) =>
  ok(res, await service.createComicAdmin(req.user?.id, normalizeComicPayload(req)), 'Tạo truyện thành công', 201)
);
exports.updateComic = asyncHandler(async (req, res) =>
  ok(res, await service.updateComicAdmin(Number(req.params.id), normalizeComicPayload(req)), 'Cập nhật truyện thành công')
);
exports.deleteComic = asyncHandler(async (req, res) =>
  ok(res, await service.deleteComicAdmin(Number(req.params.id)), 'Xóa truyện thành công')
);

exports.listChapters = asyncHandler(async (req, res) =>
  ok(res, await service.listChaptersAdmin(req.query), 'Lấy chapters admin thành công')
);
exports.getChapterDetail = asyncHandler(async (req, res) =>
  ok(res, await service.getChapterAdminDetail(Number(req.params.id)), 'Lấy chi tiết chapter thành công')
);
exports.createChapter = asyncHandler(async (req, res) =>
  ok(res, await service.createChapterAdmin(normalizeChapterPayload(req)), 'Tạo chapter thành công', 201)
);
exports.updateChapter = asyncHandler(async (req, res) =>
  ok(res, await service.updateChapterAdmin(Number(req.params.id), normalizeChapterPayload(req)), 'Cập nhật chapter thành công')
);
exports.deleteChapter = asyncHandler(async (req, res) =>
  ok(res, await service.deleteChapterAdmin(Number(req.params.id)), 'Xóa chapter thành công')
);

exports.addChapterImages = asyncHandler(async (req, res) => {
  const chapterId = Number(req.params.id);
  const current = await service.getChapterAdminDetail(chapterId);
  const startOrder = Array.isArray(current?.images) ? current.images.length + 1 : 1;
  const images = normalizeNewChapterImages(req, startOrder);
  ok(res, await service.addChapterImagesAdmin(chapterId, images), 'Thêm ảnh chapter thành công', 201);
});

exports.replaceChapterImage = asyncHandler(async (req, res) => {
  const imageId = Number(req.params.imageId);
  const file = req.file;
  ok(
    res,
    await service.replaceChapterImageAdmin(imageId, file ? `/uploads/chapters/${file.filename}` : null),
    'Thay ảnh chapter thành công'
  );
});

exports.deleteChapterImage = asyncHandler(async (req, res) =>
  ok(res, await service.deleteChapterImageAdmin(Number(req.params.imageId)), 'Xóa ảnh chapter thành công')
);

exports.reorderChapterImages = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.reorderChapterImagesAdmin(Number(req.params.id), parseJsonArray(req.body.images)),
    'Sắp xếp lại ảnh chapter thành công'
  )
);