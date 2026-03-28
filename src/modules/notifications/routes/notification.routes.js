const express = require('express');
const controller = require('../controllers/notification.controller');
const { requireAuth, requireRole } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/me', requireAuth, controller.listMyNotifications);
router.patch('/:id/read', requireAuth, controller.markAsRead);

router.get('/admin/system', requireAuth, requireRole('admin'), controller.listSystemNotificationsAdmin);
router.post('/admin/system', requireAuth, requireRole('admin'), controller.createSystemNotificationAdmin);
router.put('/admin/system/:id', requireAuth, requireRole('admin'), controller.updateSystemNotificationAdmin);
router.delete('/admin/system/:id', requireAuth, requireRole('admin'), controller.deleteSystemNotificationAdmin);
router.post('/admin/system/:id/send', requireAuth, requireRole('admin'), controller.sendSystemNotificationAdmin);

module.exports = router;
