const express = require('express');
const controller = require('../controllers/comic.controller');
const { requireAuth, requireRole, optionalAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Comics
 *     description: Quản lý truyện
 */

/**
 * @openapi
 * /api/comics:
 *   get:
 *     tags:
 *       - Comics
 *     summary: Lấy danh sách truyện
 *     parameters:
 *       - name: page
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *         example: 1
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *         example: 10
 *       - name: keyword
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *         example: test
 *     responses:
 *       200:
 *         description: Lấy danh sách truyện thành công
 */
router.get('/', optionalAuth, controller.listComics);

/**
 * @openapi
 * /api/comics/{id}:
 *   get:
 *     tags:
 *       - Comics
 *     summary: Lấy chi tiết truyện
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Lấy chi tiết truyện thành công
 *       404:
 *         description: Không tìm thấy truyện
 */
router.get('/:id', optionalAuth, controller.getComicDetail);

/**
 * @openapi
 * /api/comics:
 *   post:
 *     tags:
 *       - Comics
 *     summary: Tạo truyện
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - slug
 *             properties:
 *               title:
 *                 type: string
 *                 example: Truyện test123
 *               slug:
 *                 type: string
 *                 example: truyen-test123
 *               summary:
 *                 type: string
 *                 example: Mô tả test
 *               publicationStatus:
 *                 type: string
 *                 example: published
 *               visibilityStatus:
 *                 type: string
 *                 example: public
 *               ageRating:
 *                 type: string
 *                 example: all
 *               genreIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: []
 *     responses:
 *       200:
 *         description: Tạo truyện thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền admin
 */
router.post('/', requireAuth, requireRole('admin'), controller.createComic);

/**
 * @openapi
 * /api/comics/{id}:
 *   put:
 *     tags:
 *       - Comics
 *     summary: Cập nhật truyện
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
 *               title:
 *                 type: string
 *                 example: Truyện test update
 *               slug:
 *                 type: string
 *                 example: truyen-test-update
 *               summary:
 *                 type: string
 *                 example: Mô tả đã cập nhật
 *               publicationStatus:
 *                 type: string
 *                 example: published
 *               visibilityStatus:
 *                 type: string
 *                 example: public
 *               ageRating:
 *                 type: string
 *                 example: all
 *               genreIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: []
 *     responses:
 *       200:
 *         description: Cập nhật truyện thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền admin
 */
router.put('/:id', requireAuth, requireRole('admin'), controller.updateComic);
router.post('/:id/follow', requireAuth, controller.followComic);
router.delete('/:id/follow', requireAuth, controller.unfollowComic);

module.exports = router;