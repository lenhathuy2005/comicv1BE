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

exports.getGuildDetailAggregate = asyncHandler(async (req, res) => {
  const userId = resolveCurrentUserId(req);
  const data = await guildService.getGuildDetailAggregate(req.params.id, userId);
  return ApiResponse.success(res, data, 'Lấy tổng quan bang thành công');
});

exports.getGuildCreationRequirements = asyncHandler(async (_req, res) => {
  const data = await guildService.getGuildCreationRequirements();
  return ApiResponse.success(res, data, 'Lấy điều kiện tạo bang thành công');
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

exports.cancelJoinRequest = asyncHandler(async (req, res) => {
  const userId = resolveCurrentUserId(req);
  const data = await guildService.cancelJoinRequest({
    guildId: req.params.id,
    userId,
  });
  return ApiResponse.success(res, data, 'Hủy đơn xin gia nhập bang thành công');
});

exports.approveJoinRequest = asyncHandler(async (req, res) => {
  const reviewerUserId = resolveCurrentUserId(req);

  const data = await guildService.approveJoinRequest({
    requestId: req.params.requestId,
    reviewerUserId,
  });

  return ApiResponse.success(res, data, 'Duyệt đơn xin vào bang thành công');
});

exports.rejectJoinRequest = asyncHandler(async (req, res) => {
  const reviewerUserId = resolveCurrentUserId(req);

  const data = await guildService.rejectJoinRequest({
    requestId: req.params.requestId,
    reviewerUserId,
  });

  return ApiResponse.success(res, data, 'Từ chối đơn xin vào bang thành công');
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

exports.listGuildJoinRequests = asyncHandler(async (req, res) => {
  const userId = resolveCurrentUserId(req);
  const data = await guildService.listGuildJoinRequests(req.params.id, userId);
  return ApiResponse.success(res, data, 'Lấy danh sách đơn gia nhập bang thành công');
});

exports.listGuildLogs = asyncHandler(async (req, res) => {
  const data = await guildService.listGuildLogs(req.params.id);
  return ApiResponse.success(res, data, 'Lấy nhật ký bang thành công');
});

exports.listGuildDonations = asyncHandler(async (req, res) => {
  const data = await guildService.listGuildDonations(req.params.id);
  return ApiResponse.success(res, data, 'Lấy lịch sử đóng góp bang thành công');
});

exports.listGuildAnnouncements = asyncHandler(async (req, res) => {
  const data = await guildService.listGuildAnnouncements(req.params.id);
  return ApiResponse.success(res, data, 'Lấy danh sách thông báo bang thành công');
});

exports.leaveGuild = asyncHandler(async (req, res) => {
  const userId = resolveCurrentUserId(req);
  const data = await guildService.leaveGuild({
    guildId: req.params.id,
    userId,
  });
  return ApiResponse.success(res, data, 'Rời bang thành công');
});

exports.updateGuild = asyncHandler(async (req, res) => {
  const userId = resolveCurrentUserId(req);
  const data = await guildService.updateGuild({
    guildId: req.params.id,
    userId,
    name: req.body.name,
    slug: req.body.slug,
    logoUrl: req.body.logo_url,
    description: req.body.description,
    memberLimit: req.body.member_limit,
    guildStatus: req.body.guild_status,
  });
  return ApiResponse.success(res, data, 'Cập nhật bang thành công');
});

exports.updateGuildAnnouncement = asyncHandler(async (req, res) => {
  const userId = resolveCurrentUserId(req);
  const data = await guildService.updateGuildAnnouncement({
    guildId: req.params.id,
    userId,
    title: req.body.title,
    announcement: req.body.announcement,
  });
  return ApiResponse.success(res, data, 'Cập nhật thông báo bang thành công');
});
