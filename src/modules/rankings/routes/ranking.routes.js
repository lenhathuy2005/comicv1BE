const express = require('express');
const rankingController = require('../controllers/ranking.controller');
const { requireAuth, requireRole } = require('../../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Rankings
 *     description: Bảng xếp hạng hệ thống
 */

/**
 * @openapi
 * /api/rankings/types:
 *   get:
 *     tags:
 *       - Rankings
 *     summary: Lấy các loại ranking
 *     responses:
 *       200:
 *         description: Lấy danh sách loại ranking thành công
 */
router.get('/types', rankingController.getRankingTypes);

/**
 * @openapi
 * /api/rankings/{type}:
 *   get:
 *     tags:
 *       - Rankings
 *     summary: Lấy danh sách bảng xếp hạng theo loại
 *     parameters:
 *       - name: type
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: power
 *     responses:
 *       200:
 *         description: Lấy bảng xếp hạng thành công
 *       400:
 *         description: Loại ranking không hợp lệ
 */
router.get('/:type', rankingController.getRankingList);

/**
 * @openapi
 * /api/rankings/{type}/me:
 *   get:
 *     tags:
 *       - Rankings
 *     summary: Lấy thứ hạng của tôi theo loại
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: type
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: power
 *     responses:
 *       200:
 *         description: Lấy thứ hạng của tôi thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.get('/:type/me', requireAuth, rankingController.getMyRanking);

/**
 * @openapi
 * /api/rankings/{type}/snapshot:
 *   post:
 *     tags:
 *       - Rankings
 *     summary: Tạo snapshot bảng xếp hạng
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: type
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: power
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limit:
 *                 type: integer
 *                 example: 50
 *     responses:
 *       200:
 *         description: Tạo snapshot thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền admin
 */
router.post('/:type/snapshot', requireAuth, requireRole('admin'), rankingController.createSnapshot);

module.exports = router;