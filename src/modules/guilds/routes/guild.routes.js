const express = require('express');
const controller = require('../controllers/guild.controller');
const { requireAuth, requireRole } = require('../../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Guilds
 *     description: Hệ thống bang hội
 */

/**
 * @openapi
 * /api/guilds:
 *   get:
 *     tags:
 *       - Guilds
 *     summary: Lấy danh sách guild
 *     responses:
 *       200:
 *         description: Lấy danh sách guild thành công
 */
router.get('/', controller.listGuilds);

/**
 * @openapi
 * /api/guilds/{id}:
 *   get:
 *     tags:
 *       - Guilds
 *     summary: Lấy chi tiết guild
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Lấy chi tiết guild thành công
 */
router.get('/:id', controller.getGuildDetail);

/**
 * @openapi
 * /api/guilds/{id}/members:
 *   get:
 *     tags:
 *       - Guilds
 *     summary: Lấy danh sách thành viên guild
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
 *         description: Lấy danh sách thành viên thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.get('/:id/members', requireAuth, controller.listGuildMembers);

/**
 * @openapi
 * /api/guilds:
 *   post:
 *     tags:
 *       - Guilds
 *     summary: Tạo guild
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Thiên Lôi Các
 *               slug:
 *                 type: string
 *                 example: thien-loi-cac
 *               description:
 *                 type: string
 *                 example: Bang hội chuyên lôi hệ
 *     responses:
 *       200:
 *         description: Tạo guild thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.post('/', requireAuth, controller.createGuild);

/**
 * @openapi
 * /api/guilds/{id}/join-requests:
 *   post:
 *     tags:
 *       - Guilds
 *     summary: Gửi yêu cầu tham gia guild
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requestMessage:
 *                 type: string
 *                 example: Xin gia nhập bang để cùng làm nhiệm vụ.
 *     responses:
 *       200:
 *         description: Gửi yêu cầu tham gia guild thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.post('/:id/join-requests', requireAuth, controller.requestJoinGuild);

/**
 * @openapi
 * /api/guilds/join-requests/{requestId}/approve:
 *   post:
 *     tags:
 *       - Guilds
 *     summary: Duyệt yêu cầu tham gia guild
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: requestId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Duyệt yêu cầu thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền thực hiện
 */
router.post(
  '/join-requests/:requestId/approve',
  requireAuth,
  requireRole('admin', 'user'),
  controller.approveJoinRequest
);

/**
 * @openapi
 * /api/guilds/{id}/donations:
 *   post:
 *     tags:
 *       - Guilds
 *     summary: Đóng góp vào guild
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               donationType:
 *                 type: string
 *                 example: gold
 *               amount:
 *                 type: number
 *                 example: 500
 *               itemId:
 *                 type: integer
 *                 example: 1
 *               quantity:
 *                 type: integer
 *                 example: 1
 *               note:
 *                 type: string
 *                 example: Đóng góp bang hội
 *     responses:
 *       200:
 *         description: Đóng góp thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.post('/:id/donations', requireAuth, controller.donateToGuild);

module.exports = router;