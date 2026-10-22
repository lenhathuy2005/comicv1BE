const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const authService = require('../services/auth.service');

function clientContext(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

exports.register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body, clientContext(req));
  return ApiResponse.success(res, data, 'Đăng ký thành công', 201);
});

exports.login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body, clientContext(req));
  return ApiResponse.success(res, data, 'Đăng nhập thành công');
});

exports.me = asyncHandler(async (req, res) => {
  const data = await authService.getCurrentUser(req.user.id);
  return ApiResponse.success(res, data, 'Lấy thông tin cá nhân thành công');
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const data = await authService.forgotPassword(req.body.email, clientContext(req));
  return ApiResponse.success(res, data, 'Yêu cầu quên mật khẩu đã được ghi nhận');
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const data = await authService.resetPassword(req.body.token, req.body.newPassword);
  return ApiResponse.success(res, data, 'Đặt lại mật khẩu thành công');
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
  const data = await authService.refreshToken(refreshToken, clientContext(req));
  return ApiResponse.success(res, data, 'Làm mới token thành công');
});

exports.logout = asyncHandler(async (req, res) => {
  const tokenValue = req.body.tokenValue;
  const data = await authService.logout(req.user.id, tokenValue);
  return ApiResponse.success(res, data, 'Đăng xuất thành công');
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const data = await authService.verifyEmail(req.body.token);
  return ApiResponse.success(res, data, 'Xác thực email thành công');
});