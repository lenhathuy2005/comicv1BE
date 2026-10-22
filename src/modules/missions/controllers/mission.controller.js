const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const missionService = require('../services/mission.service');

exports.listMyMissions = asyncHandler(async (req, res) => {
  const data = await missionService.listMyMissions({
    userId: req.user.id,
    type: req.query.type || null,
  });

  return ApiResponse.success(res, data, 'Lấy danh sách mission của tôi thành công');
});

exports.claimMissionReward = asyncHandler(async (req, res) => {
  const data = await missionService.claimMissionReward({
    userId: req.user.id,
    missionId: Number(req.params.id),
  });

  return ApiResponse.success(res, data, 'Nhận thưởng mission thành công');
});