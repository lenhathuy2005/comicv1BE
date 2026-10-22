const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const userService = require('../services/user.service');

exports.listUsers = asyncHandler(async (req, res) => {
  const data = await userService.listUsers(req.query);
  return ApiResponse.success(res, data, 'Lấy danh sách user thành công');
});

exports.getUserDetail = asyncHandler(async (req, res) => {
  const data = await userService.getUserDetail(req.params.id);
  return ApiResponse.success(res, data, 'Lấy chi tiết user thành công');
});

exports.updateUserStatus = asyncHandler(async (req, res) => {
  const data = await userService.updateUserStatus({
    userId: Number(req.params.id),
    newStatus: req.body.newStatus,
    changedByUserId: req.user.id,
    reason: req.body.reason || null,
  });

  return ApiResponse.success(res, data, 'Cập nhật trạng thái user thành công');
});
