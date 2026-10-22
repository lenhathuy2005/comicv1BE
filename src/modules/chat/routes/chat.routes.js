const express = require('express');
const controller = require('../controllers/chat.controller');
const { requireAuth, requireRole } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/rooms', controller.listRooms);
router.get('/rooms/:roomId/messages', controller.getRoomMessages);
router.post('/rooms/:roomId/messages', requireAuth, controller.sendMessage);

router.get('/admin/rooms', requireAuth, requireRole('admin'), controller.listRoomsAdmin);
router.get('/admin/rooms/:roomId/messages', requireAuth, requireRole('admin'), controller.getRoomMessagesAdmin);
router.post('/admin/rooms', requireAuth, requireRole('admin'), controller.createRoomAdmin);
router.put('/admin/rooms/:roomId', requireAuth, requireRole('admin'), controller.updateRoomAdmin);
router.delete('/admin/rooms/:roomId', requireAuth, requireRole('admin'), controller.deleteRoomAdmin);
router.get('/admin/reports', requireAuth, requireRole('admin'), controller.listReportsAdmin);
router.delete('/admin/messages/:messageId', requireAuth, requireRole('admin'), controller.deleteMessageAdmin);

module.exports = router;
