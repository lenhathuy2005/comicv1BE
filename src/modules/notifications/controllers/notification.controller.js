const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const notificationService = require('../services/notification.service');

exports.listMyNotifications = asyncHandler(async (req, res) => {
  const data = await notificationService.listMyNotifications(req.user.id, req.query);
  return ApiResponse.success(res, data, 'Lấy danh sách thông báo thành công');
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAsRead(req.user.id, req.params.id);
  return ApiResponse.success(res, data, 'Đánh dấu đã đọc thành công');
});

exports.listSystemNotificationsAdmin = asyncHandler(async (req, res) => {
  const data = await notificationService.listSystemNotificationsAdmin(req.query);
  return ApiResponse.success(res, data, 'Lấy danh sách thông báo hệ thống thành công');
});

exports.createSystemNotificationAdmin = asyncHandler(async (req, res) => {
  const data = await notificationService.createSystemNotificationAdmin(req.user.id, req.body);
  return ApiResponse.success(res, data, 'Tạo thông báo hệ thống thành công', 201);
});

exports.updateSystemNotificationAdmin = asyncHandler(async (req, res) => {
  const data = await notificationService.updateSystemNotificationAdmin(req.params.id, req.body);
  return ApiResponse.success(res, data, 'Cập nhật thông báo hệ thống thành công');
});

exports.deleteSystemNotificationAdmin = asyncHandler(async (req, res) => {
  const data = await notificationService.deleteSystemNotificationAdmin(req.params.id);
  return ApiResponse.success(res, data, 'Xóa thông báo hệ thống thành công');
});

exports.sendSystemNotificationAdmin = asyncHandler(async (req, res) => {
  const data = await notificationService.sendSystemNotificationAdmin(req.params.id, req.user.id, req.body);
  return ApiResponse.success(res, data, 'Gửi thông báo thành công');
});
