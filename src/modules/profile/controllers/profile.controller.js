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
    bio: req.body.bio,
    avatar_url: req.body.avatar_url,
  });

  return ApiResponse.success(res, data, 'Cập nhật profile thành công');
});