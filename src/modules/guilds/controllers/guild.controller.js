const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const guildService = require('../services/guild.service');

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

exports.listGuilds = asyncHandler(async (_req, res) => {
  const data = await guildService.listGuilds();
  return ApiResponse.success(res, data, 'Lấy danh sách bang thành công');
});

exports.getGuildDetail = asyncHandler(async (req, res) => {
  const data = await guildService.getGuildDetail(req.params.id);
  return ApiResponse.success(res, data, 'Lấy chi tiết bang thành công');
});

exports.createGuild = asyncHandler(async (req, res) => {
  const userId = resolveCurrentUserId(req);

  const data = await guildService.createGuild({
    userId,
    ...req.body,
  });

  return ApiResponse.success(res, data, 'Tạo bang thành công', 201);
});

exports.requestJoinGuild = asyncHandler(async (req, res) => {
  const userId = resolveCurrentUserId(req);

  const data = await guildService.requestJoinGuild({
    guildId: req.params.id,
    userId,
    requestMessage: req.body.requestMessage,
  });

  return ApiResponse.success(res, data, 'Gửi đơn xin gia nhập bang thành công', 201);
});

exports.approveJoinRequest = asyncHandler(async (req, res) => {
  const reviewerUserId = resolveCurrentUserId(req);

  const data = await guildService.approveJoinRequest({
    requestId: req.params.requestId,
    reviewerUserId,
  });

  return ApiResponse.success(res, data, 'Duyệt đơn xin vào bang thành công');
});

exports.donateToGuild = asyncHandler(async (req, res) => {
  const userId = resolveCurrentUserId(req);

  const data = await guildService.donateToGuild({
    guildId: req.params.id,
    userId,
    ...req.body,
  });

  return ApiResponse.success(res, data, 'Donate bang thành công');
});

exports.listGuildMembers = asyncHandler(async (req, res) => {
  const data = await guildService.listGuildMembers(req.params.id);
  return ApiResponse.success(res, data, 'Lấy danh sách thành viên bang thành công');
});