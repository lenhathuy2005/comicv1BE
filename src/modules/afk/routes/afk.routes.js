const express = require('express');
const controller = require('../controllers/afk.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: AFK
 *     description: Hệ thống AFK
 */

/**
 * @openapi
 * /api/afk/configs:
 *   get:
 *     tags:
 *       - AFK
 *     summary: Lấy danh sách cấu hình AFK
 *     responses:
 *       200:
 *         description: Lấy danh sách cấu hình AFK thành công
 */
router.get('/configs', controller.listConfigs);

/**
 * @openapi
 * /api/afk/sessions:
 *   post:
 *     tags:
 *       - AFK
 *     summary: Bắt đầu phiên AFK
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Bắt đầu phiên AFK thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.post('/sessions', requireAuth, controller.startSession);

/**
 * @openapi
 * /api/afk/sessions/{id}/finish:
 *   post:
 *     tags:
 *       - AFK
 *     summary: Kết thúc phiên AFK
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Kết thúc phiên AFK thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.post('/sessions/:id/finish', requireAuth, controller.finishSession);

/**
 * @openapi
 * /api/afk/sessions/{id}/claim:
 *   post:
 *     tags:
 *       - AFK
 *     summary: Nhận thưởng phiên AFK
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Nhận thưởng AFK thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.post('/sessions/:id/claim', requireAuth, controller.claimSession);

module.exports = router;