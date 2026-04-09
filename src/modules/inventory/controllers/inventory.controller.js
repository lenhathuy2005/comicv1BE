const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const inventoryService = require('../services/inventory.service');

exports.getMyInventory = asyncHandler(async (req, res) => {
  const data = await inventoryService.getMyInventory(req.user.id);
  return ApiResponse.success(res, data, 'Lấy inventory thành công');
});

exports.useItem = asyncHandler(async (req, res) => {
  const data = await inventoryService.useItem({
    userId: req.user.id,
    itemId: req.body.item_id,
    quantity: req.body.quantity || 1,
  });

  return ApiResponse.success(res, data, 'Dùng item thành công');
});