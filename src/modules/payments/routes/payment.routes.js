const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/payment.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

// Lấy danh sách package gợi ý
router.get('/packages', requireAuth, paymentController.getPaymentPackages);

// Lấy lịch sử thanh toán của tôi
router.get('/me', requireAuth, paymentController.getMyPayments);

// Tạo giao dịch nạp tự do
router.post('/topup', requireAuth, paymentController.createTopup);

// Confirm giao dịch
router.post('/:id/confirm', requireAuth, paymentController.confirmPayment);

// Callback từ cổng thanh toán
router.post('/callback', paymentController.paymentCallback);

module.exports = router;