const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const checkinService = require('../services/checkin.service');

exports.getMyCheckinStatus = asyncHandler(async (req, res) => {
  const data = await checkinService.getMyCheckinStatus(req.user.id);
  return ApiResponse.success(res, data, 'Lấy trạng thái checkin thành công');
});

exports.getMyCheckinHistory = asyncHandler(async (req, res) => {
  const data = await checkinService.getMyCheckinHistory(req.user.id);
  return ApiResponse.success(res, data, 'Lấy lịch sử checkin thành công');
});

exports.checkinToday = asyncHandler(async (req, res) => {
  const data = await checkinService.checkinToday(req.user.id);
  return ApiResponse.success(res, data, 'Checkin thành công');
});