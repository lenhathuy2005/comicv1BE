const express = require('express');
const controller = require('../controllers/checkin.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/me', requireAuth, controller.getMyCheckinStatus);
router.get('/history', requireAuth, controller.getMyCheckinHistory);
router.post('/', requireAuth, controller.checkinToday);

module.exports = router;