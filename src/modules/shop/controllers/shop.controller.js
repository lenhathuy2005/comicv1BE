const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const shopService = require('../services/shop.service');

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

// =========================
// USER-FACING
// =========================

exports.listShopItems = asyncHandler(async (_req, res) => {
  const data = await shopService.listShopItems();
  return ApiResponse.success(res, data, 'Lấy danh sách vật phẩm shop thành công');
});

exports.buyItem = asyncHandler(async (req, res) => {
  const userId = resolveCurrentUserId(req);

  const data = await shopService.buyItem({
    userId,
    shopItemId: req.params.shopItemId,
    quantity: req.body.quantity || 1,
  });

  return ApiResponse.success(res, data, 'Mua vật phẩm thành công');
});

// =========================
// ADMIN - ITEM TYPES
// =========================

exports.listItemTypesAdmin = asyncHandler(async (_req, res) => {
  const data = await shopService.listItemTypesAdmin();
  return ApiResponse.success(res, data, 'Lấy danh sách loại vật phẩm thành công');
});

exports.createItemTypeAdmin = asyncHandler(async (req, res) => {
  const data = await shopService.createItemTypeAdmin(req.body);
  return ApiResponse.success(res, data, 'Tạo loại vật phẩm thành công', 201);
});

exports.updateItemTypeAdmin = asyncHandler(async (req, res) => {
  const data = await shopService.updateItemTypeAdmin(req.params.id, req.body);
  return ApiResponse.success(res, data, 'Cập nhật loại vật phẩm thành công');
});

// =========================
// ADMIN - ITEMS
// =========================

exports.listItemsAdmin = asyncHandler(async (_req, res) => {
  const data = await shopService.listItemsAdmin();
  return ApiResponse.success(res, data, 'Lấy danh sách items thành công');
});

exports.createItemAdmin = asyncHandler(async (req, res) => {
  const actorUserId = resolveCurrentUserId(req);
  const data = await shopService.createItemAdmin(req.body, actorUserId);
  return ApiResponse.success(res, data, 'Tạo item thành công', 201);
});

exports.updateItemAdmin = asyncHandler(async (req, res) => {
  const actorUserId = resolveCurrentUserId(req);
  const data = await shopService.updateItemAdmin(req.params.id, req.body, actorUserId);
  return ApiResponse.success(res, data, 'Cập nhật item thành công');
});

// =========================
// ADMIN - SHOP ITEMS
// =========================

exports.listShopItemsAdmin = asyncHandler(async (_req, res) => {
  const data = await shopService.listShopItemsAdmin();
  return ApiResponse.success(res, data, 'Lấy danh sách shop items thành công');
});

exports.createShopItemAdmin = asyncHandler(async (req, res) => {
  const data = await shopService.createShopItemAdmin(req.body);
  return ApiResponse.success(res, data, 'Tạo shop item thành công', 201);
});

exports.updateShopItemAdmin = asyncHandler(async (req, res) => {
  const data = await shopService.updateShopItemAdmin(req.params.id, req.body);
  return ApiResponse.success(res, data, 'Cập nhật shop item thành công');
});


exports.deleteItemTypeAdmin = asyncHandler(async (req, res) => {
  const data = await shopService.deleteItemTypeAdmin(req.params.id);
  return ApiResponse.success(res, data, 'Xóa loại vật phẩm thành công');
});

exports.deleteItemAdmin = asyncHandler(async (req, res) => {
  const data = await shopService.deleteItemAdmin(req.params.id);
  return ApiResponse.success(res, data, 'Ẩn vật phẩm thành công');
});

exports.deleteShopItemAdmin = asyncHandler(async (req, res) => {
  const data = await shopService.deleteShopItemAdmin(req.params.id);
  return ApiResponse.success(res, data, 'Gỡ vật phẩm khỏi shop thành công');
});

exports.listTransactionsAdmin = asyncHandler(async (req, res) => {
  const data = await shopService.listTransactionsAdmin(req.query);
  return ApiResponse.success(res, data, 'Lấy danh sách giao dịch thành công');
});

module.exports = exports;