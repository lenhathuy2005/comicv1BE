const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const chapterService = require('../services/chapter.service');

exports.listChaptersByComic = asyncHandler(async (req, res) => {
  const data = await chapterService.listChaptersByComic(req.params.comicId);
  return ApiResponse.success(res, data, 'Lấy danh sách chapter thành công');
});

exports.getChapterDetail = asyncHandler(async (req, res) => {
  const data = await chapterService.getChapterDetail(req.params.id, req.user?.id || null);
  return ApiResponse.success(res, data, 'Lấy chi tiết chapter thành công');
});

exports.createChapter = asyncHandler(async (req, res) => {
  const data = await chapterService.createChapter(req.body);
  return ApiResponse.success(res, data, 'Tạo chapter thành công', 201);
});

exports.updateChapter = asyncHandler(async (req, res) => {
  const data = await chapterService.updateChapter(req.params.id, req.body);
  return ApiResponse.success(res, data, 'Cập nhật chapter thành công');
});
exports.saveReadingProgress = asyncHandler(async (req, res) => {
  const data = await chapterService.saveReadingProgress({
    userId: req.user.id,
    chapterId: req.params.id,
    lastPageNumber: req.body.last_page_number ?? req.body.lastPageNumber ?? 1,
    progressPercent: req.body.progress_percent ?? req.body.progressPercent,
  });
  return ApiResponse.success(res, data, 'Lưu tiến độ đọc thành công');
});
