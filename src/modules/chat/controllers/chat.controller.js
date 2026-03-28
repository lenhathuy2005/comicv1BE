const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const chatService = require('../services/chat.service');

exports.listRooms = asyncHandler(async (req, res) => {
  const data = await chatService.listRooms(req.query);
  return ApiResponse.success(res, data, 'Lấy danh sách room chat thành công');
});

exports.getRoomMessages = asyncHandler(async (req, res) => {
  const data = await chatService.getRoomMessages(req.params.roomId, req.query.limit);
  return ApiResponse.success(res, data, 'Lấy danh sách tin nhắn thành công');
});

exports.sendMessage = asyncHandler(async (req, res) => {
  const data = await chatService.sendMessage(req.params.roomId, req.user.id, req.body);
  return ApiResponse.success(res, data, 'Gửi tin nhắn thành công', 201);
});

exports.listRoomsAdmin = asyncHandler(async (req, res) => {
  const data = await chatService.listRoomsAdmin(req.query);
  return ApiResponse.success(res, data, 'Lấy danh sách phòng chat admin thành công');
});

exports.getRoomMessagesAdmin = asyncHandler(async (req, res) => {
  const data = await chatService.getRoomMessagesAdmin(req.params.roomId, req.query.limit);
  return ApiResponse.success(res, data, 'Lấy danh sách tin nhắn admin thành công');
});

exports.createRoomAdmin = asyncHandler(async (req, res) => {
  const data = await chatService.createRoomAdmin(req.user.id, req.body);
  return ApiResponse.success(res, data, 'Tạo phòng chat thành công', 201);
});

exports.updateRoomAdmin = asyncHandler(async (req, res) => {
  const data = await chatService.updateRoomAdmin(req.params.roomId, req.body);
  return ApiResponse.success(res, data, 'Cập nhật phòng chat thành công');
});

exports.deleteRoomAdmin = asyncHandler(async (req, res) => {
  const data = await chatService.deleteRoomAdmin(req.params.roomId);
  return ApiResponse.success(res, data, 'Ẩn phòng chat thành công');
});

exports.listReportsAdmin = asyncHandler(async (_req, res) => {
  const data = await chatService.listReportsAdmin();
  return ApiResponse.success(res, data, 'Lấy danh sách báo cáo tin nhắn thành công');
});

exports.deleteMessageAdmin = asyncHandler(async (req, res) => {
  const data = await chatService.deleteMessageAdmin(req.params.messageId);
  return ApiResponse.success(res, data, 'Ẩn tin nhắn thành công');
});
