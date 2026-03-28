const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const vipService = require('../services/vip.service');

exports.listVipLevels = asyncHandler(async (_req, res) => {
  const data = await vipService.listVipLevels();
  return ApiResponse.success(res, data, 'Lấy danh sách VIP level thành công');
});

exports.myVip = asyncHandler(async (req, res) => {
  const data = await vipService.myVip(req.user.id);
  return ApiResponse.success(res, data, 'Lấy thông tin VIP của user thành công');
});

exports.listFeatureUnlocks = asyncHandler(async (_req, res) => {
  const data = await vipService.listFeatureUnlocks();
  return ApiResponse.success(res, data, 'Lấy danh sách feature unlock theo VIP thành công');
});
