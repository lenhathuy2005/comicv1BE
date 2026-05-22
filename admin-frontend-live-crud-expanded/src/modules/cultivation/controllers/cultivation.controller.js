const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const service = require('../services/cultivation.service');

exports.getMe = asyncHandler(async (req, res) => {
  ApiResponse.success(res, await service.getMyCultivation(req.user.id), 'Lấy dữ liệu cảnh giới thành công');
});

exports.listRealms = asyncHandler(async (req, res) => {
  ApiResponse.success(res, await service.listRealms(), 'Lấy danh sách cảnh giới thành công');
});

exports.listLevels = asyncHandler(async (req, res) => {
  ApiResponse.success(res, await service.listLevels(), 'Lấy danh sách cấp độ thành công');
});

exports.listBreakthroughRules = asyncHandler(async (req, res) => {
  ApiResponse.success(res, await service.listBreakthroughRules(), 'Lấy luật đột phá thành công');
});

exports.attemptBreakthrough = asyncHandler(async (req, res) => {
  const result = await service.attemptBreakthrough(req.user.id, Boolean(req.body?.use_insurance || req.body?.useInsurance));
  ApiResponse.success(res, result, result.success ? 'Đột phá thành công' : 'Đột phá thất bại');
});
