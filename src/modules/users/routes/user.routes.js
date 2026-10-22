const express = require('express');
const controller = require('../controllers/user.controller');
const { requireAuth, requireRole } = require('../../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Users
 *     description: Quản lý người dùng
 */

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags:
 *       - Users
 *     summary: Lấy danh sách user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách user thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền admin
 */
router.get('/', requireAuth, requireRole('admin'), controller.listUsers);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Lấy chi tiết user
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
 *         description: Lấy chi tiết user thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       404:
 *         description: Không tìm thấy user
 */
router.get('/:id', requireAuth, controller.getUserDetail);

/**
 * @openapi
 * /api/users/{id}/status:
 *   patch:
 *     tags:
 *       - Users
 *     summary: Cập nhật trạng thái user
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
 *             required:
 *               - newStatus
 *             properties:
 *               newStatus:
 *                 type: string
 *                 enum: [active, banned, suspended, pending]
 *                 example: active
 *               reason:
 *                 type: string
 *                 example: admin update
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái user thành công
 *       400:
 *         description: Trạng thái không hợp lệ
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền admin
 */
router.patch('/:id/status', requireAuth, requireRole('admin'), controller.updateUserStatus);

module.exports = router;