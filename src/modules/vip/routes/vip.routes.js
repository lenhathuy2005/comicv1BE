const express = require('express');
const controller = require('../controllers/vip.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: VIP
 *     description: Hệ thống VIP
 */

/**
 * @openapi
 * /api/vip/levels:
 *   get:
 *     tags:
 *       - VIP
 *     summary: Lấy danh sách cấp VIP
 *     responses:
 *       200:
 *         description: Lấy danh sách cấp VIP thành công
 */
router.get('/levels', controller.listVipLevels);

/**
 * @openapi
 * /api/vip/features:
 *   get:
 *     tags:
 *       - VIP
 *     summary: Lấy danh sách tính năng mở khóa VIP
 *     responses:
 *       200:
 *         description: Lấy danh sách tính năng VIP thành công
 */
router.get('/features', controller.listFeatureUnlocks);

/**
 * @openapi
 * /api/vip/me:
 *   get:
 *     tags:
 *       - VIP
 *     summary: Lấy thông tin VIP của tôi
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thông tin VIP của tôi thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.get('/me', requireAuth, controller.myVip);

module.exports = router;