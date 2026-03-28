const rankingService = require('../services/ranking.service');
const ApiError = require('../../../utils/ApiError');

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

async function getRankingTypes(_req, res, next) {
  try {
    const data = await rankingService.getAvailableRankingTypes();
    return res.json({
      success: true,
      message: 'Lấy danh sách loại ranking thành công',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function getRankingList(req, res, next) {
  try {
    const type = req.params.type || req.query.type;
    if (!type) throw new ApiError(400, 'type là bắt buộc');

    const limit = req.query.limit || 20;
    const preferSnapshot = req.query.preferSnapshot !== 'false';

    const data = await rankingService.listRankings(type, limit, preferSnapshot);

    return res.json({
      success: true,
      message: 'Lấy bảng xếp hạng thành công',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function getMyRanking(req, res, next) {
  try {
    const type = req.params.type || req.query.type;
    const userId = resolveCurrentUserId(req);

    if (!type) {
      throw new ApiError(400, 'type là bắt buộc');
    }

    if (!userId) {
      throw new ApiError(401, 'Không xác định được user hiện tại');
    }

    const data = await rankingService.getMyRanking(type, userId);

    return res.json({
      success: true,
      message: 'Lấy thứ hạng của tôi thành công',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function createSnapshot(req, res, next) {
  try {
    const type = req.params.type;
    const actorUserId = resolveCurrentUserId(req);
    const limit = req.body?.limit || req.query?.limit || 100;

    const data = await rankingService.createRankingSnapshot(type, actorUserId, limit);

    return res.status(201).json({
      success: true,
      message: 'Tạo ranking snapshot thành công',
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRankingTypes,
  getRankingList,
  getMyRanking,
  createSnapshot,
};