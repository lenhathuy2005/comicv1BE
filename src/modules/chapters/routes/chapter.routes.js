const express = require('express');
const controller = require('../controllers/chapter.controller');
const { requireAuth, requireRole, optionalAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Chapters
 *     description: Quản lý chapter
 */

/**
 * @openapi
 * /api/chapters/comic/{comicId}:
 *   get:
 *     tags:
 *       - Chapters
 *     summary: Lấy danh sách chapter theo comic
 *     parameters:
 *       - name: comicId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Lấy danh sách chapter thành công
 */
router.get('/comic/:comicId', controller.listChaptersByComic);

/**
 * @openapi
 * /api/chapters/{id}:
 *   get:
 *     tags:
 *       - Chapters
 *     summary: Lấy chi tiết chapter
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 4
 *     responses:
 *       200:
 *         description: Lấy chi tiết chapter thành công
 *       404:
 *         description: Không tìm thấy chapter
 */
router.get('/:id', optionalAuth, controller.getChapterDetail);

/**
 * @openapi
 * /api/chapters:
 *   post:
 *     tags:
 *       - Chapters
 *     summary: Tạo chapter
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comicId:
 *                 type: integer
 *                 example: 1
 *               chapterNumber:
 *                 type: number
 *                 example: 1
 *               title:
 *                 type: string
 *                 example: Chapter 1
 *               slug:
 *                 type: string
 *                 example: chapter-1
 *               accessType:
 *                 type: string
 *                 example: free
 *               publishStatus:
 *                 type: string
 *                 example: published
 *               releasedAt:
 *                 type: string
 *                 example: 2026-03-10 10:00:00
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     imageUrl:
 *                       type: string
 *                       example: https://example.com/chapter1-page1.jpg
 *                     displayOrder:
 *                       type: integer
 *                       example: 1
 *     responses:
 *       200:
 *         description: Tạo chapter thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền admin
 */
router.post('/', requireAuth, requireRole('admin'), controller.createChapter);

/**
 * @openapi
 * /api/chapters/{id}:
 *   put:
 *     tags:
 *       - Chapters
 *     summary: Cập nhật chapter
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 4
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chapterNumber:
 *                 type: number
 *                 example: 1
 *               title:
 *                 type: string
 *                 example: Chapter 1
 *               slug:
 *                 type: string
 *                 example: chapter-1
 *               accessType:
 *                 type: string
 *                 example: free
 *               publishStatus:
 *                 type: string
 *                 example: published
 *               releasedAt:
 *                 type: string
 *                 example: 2026-03-10 10:00:00
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     imageUrl:
 *                       type: string
 *                       example: https://example.com/chapter1-page1-updated.jpg
 *                     displayOrder:
 *                       type: integer
 *                       example: 1
 *     responses:
 *       200:
 *         description: Cập nhật chapter thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền admin
 */
router.put('/:id', requireAuth, requireRole('admin'), controller.updateChapter);
router.post('/:id/read-progress', requireAuth, controller.saveReadingProgress);

module.exports = router;