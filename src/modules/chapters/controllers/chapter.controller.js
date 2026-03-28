const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const chapterService = require('../services/chapter.service');

exports.listChaptersByComic = asyncHandler(async (req, res) => {
  const data = await chapterService.listChaptersByComic(req.params.comicId);
  return ApiResponse.success(res, data, 'Lấy danh sách chapter thành công');
});

exports.getChapterDetail = asyncHandler(async (req, res) => {
  const data = await chapterService.getChapterDetail(req.params.id);
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