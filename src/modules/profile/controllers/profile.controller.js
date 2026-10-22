const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const profileService = require('../services/profile.service');

exports.getMyProfile = asyncHandler(async (req, res) => {
  const data = await profileService.getMyProfile(req.user.id);
  return ApiResponse.success(res, data, 'Lấy profile của tôi thành công');
});

exports.updateMyProfile = asyncHandler(async (req, res) => {
  const data = await profileService.updateMyProfile(req.user.id, {
    display_name: req.body.display_name,
    avatar_url: req.body.avatar_url,
    full_name: req.body.full_name,
    phone_number: req.body.phone_number,
    bio: req.body.bio,
    gender: req.body.gender,
    birth_date: req.body.birth_date,
    country: req.body.country,
  });

  return ApiResponse.success(res, data, 'Cập nhật profile thành công');
});

exports.getMyActivities = asyncHandler(async (req, res) => {
  const data = await profileService.getMyActivities(req.user.id, req.query.limit);
  return ApiResponse.success(res, data, 'Lấy hoạt động gần đây thành công');
});

exports.getMyFollows = asyncHandler(async (req, res) => {
  const data = await profileService.getMyFollows(req.user.id);
  return ApiResponse.success(res, data, 'Lấy danh sách theo dõi thành công');
});

exports.getMyGuild = asyncHandler(async (req, res) => {
  const data = await profileService.getMyGuild(req.user.id);
  return ApiResponse.success(res, data, 'Lấy thông tin bang hội của tôi thành công');
});
