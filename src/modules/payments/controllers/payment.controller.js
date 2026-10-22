const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const paymentService = require('../services/payment.service');

exports.getPaymentPackages = asyncHandler(async (req, res) => {
  const data = await paymentService.getPaymentPackages();
  return ApiResponse.success(res, data, 'Lấy danh sách package thành công');
});

exports.getMyPayments = asyncHandler(async (req, res) => {
  const data = await paymentService.getMyPayments(req.user.id);
  return ApiResponse.success(res, data, 'Lấy lịch sử thanh toán thành công');
});

exports.createTopup = asyncHandler(async (req, res) => {
  const data = await paymentService.createTopup({
    userId: req.user.id,
    amount: req.body.amount,
    paymentMethod: req.body.payment_method || 'vnpay',
  });

  return ApiResponse.success(res, data, 'Tạo giao dịch nạp thành công', 201);
});

exports.confirmPayment = asyncHandler(async (req, res) => {
  const data = await paymentService.confirmPayment({
    userId: req.user.id,
    transactionId: Number(req.params.id),
  });

  return ApiResponse.success(res, data, 'Xác nhận thanh toán thành công');
});

exports.paymentCallback = asyncHandler(async (req, res) => {
  const data = await paymentService.paymentCallback(req.body);
  return ApiResponse.success(res, data, 'Callback thanh toán thành công');
});