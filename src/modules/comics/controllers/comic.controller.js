const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const comicService = require('../services/comic.service');

exports.listComics = asyncHandler(async (req, res) => {
  const data = await comicService.listComics(req.query);
  return ApiResponse.success(res, data, 'Lấy danh sách truyện thành công');
});

exports.getComicDetail = asyncHandler(async (req, res) => {
  const data = await comicService.getComicDetail(req.params.id);
  return ApiResponse.success(res, data, 'Lấy chi tiết truyện thành công');
});

exports.createComic = asyncHandler(async (req, res) => {
  const data = await comicService.createComic(req.body, req.user.id);
  return ApiResponse.success(res, data, 'Tạo truyện thành công', 201);
});

exports.updateComic = asyncHandler(async (req, res) => {
  const data = await comicService.updateComic(req.params.id, req.body);
  return ApiResponse.success(res, data, 'Cập nhật truyện thành công');
});
