const express = require('express');
const controller = require('../controllers/shop.controller');
const { requireAuth, requireRole } = require('../../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Shop
 *     description: Cửa hàng vật phẩm
 */

/**
 * @openapi
 * /api/shop/items:
 *   get:
 *     tags:
 *       - Shop
 *     summary: Lấy danh sách item trong shop
 *     responses:
 *       200:
 *         description: Lấy danh sách item thành công
 */
router.get('/items', controller.listShopItems);

/**
 * @openapi
 * /api/shop/items/{shopItemId}/buy:
 *   post:
 *     tags:
 *       - Shop
 *     summary: Mua item trong shop
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: shopItemId
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
 *               quantity:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Mua item thành công
 */
router.post('/items/:shopItemId/buy', requireAuth, controller.buyItem);

// =========================
// ADMIN - ITEM TYPES
// =========================

router.get('/admin/item-types', requireAuth, requireRole('admin'), controller.listItemTypesAdmin);
router.post('/admin/item-types', requireAuth, requireRole('admin'), controller.createItemTypeAdmin);
router.put('/admin/item-types/:id', requireAuth, requireRole('admin'), controller.updateItemTypeAdmin);
router.delete('/admin/item-types/:id', requireAuth, requireRole('admin'), controller.deleteItemTypeAdmin);

// =========================
// ADMIN - ITEMS
// =========================

router.get('/admin/items', requireAuth, requireRole('admin'), controller.listItemsAdmin);
router.post('/admin/items', requireAuth, requireRole('admin'), controller.createItemAdmin);
router.put('/admin/items/:id', requireAuth, requireRole('admin'), controller.updateItemAdmin);
router.delete('/admin/items/:id', requireAuth, requireRole('admin'), controller.deleteItemAdmin);

// =========================
// ADMIN - SHOP ITEMS
// =========================

router.get('/admin/shop-items', requireAuth, requireRole('admin'), controller.listShopItemsAdmin);
router.post('/admin/shop-items', requireAuth, requireRole('admin'), controller.createShopItemAdmin);
router.put('/admin/shop-items/:id', requireAuth, requireRole('admin'), controller.updateShopItemAdmin);
router.delete('/admin/shop-items/:id', requireAuth, requireRole('admin'), controller.deleteShopItemAdmin);
router.get('/admin/transactions', requireAuth, requireRole('admin'), controller.listTransactionsAdmin);

module.exports = router;