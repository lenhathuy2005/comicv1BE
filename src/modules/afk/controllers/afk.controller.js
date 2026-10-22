const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const afkService = require('../services/afk.service');

function resolveCurrentUserId(req) {
  return (
    req.user?.id ||
    req.user?.userId ||
    req.user?.user_id ||
    req.auth?.id ||
    req.auth?.userId ||
    req.auth?.user_id ||
    null
  );
}

exports.listConfigs = asyncHandler(async (_req, res) => {
  const data = await afkService.listConfigs();
  return ApiResponse.success(res, data, 'Lấy cấu hình AFK thành công');
});

exports.startSession = asyncHandler(async (req, res) => {
  const userId = resolveCurrentUserId(req);
  const data = await afkService.startSession(userId);
  return ApiResponse.success(res, data, 'Bắt đầu AFK thành công', 201);
});

exports.finishSession = asyncHandler(async (req, res) => {
  const userId = resolveCurrentUserId(req);
  const data = await afkService.finishSession(userId, req.params.id);
  return ApiResponse.success(res, data, 'Kết thúc AFK thành công');
});

exports.claimSession = asyncHandler(async (req, res) => {
  const userId = resolveCurrentUserId(req);
  const data = await afkService.claimSession(userId, req.params.id);
  return ApiResponse.success(res, data, 'Claim AFK thành công');
});