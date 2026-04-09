const express = require('express');
const controller = require('../controllers/profile.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/me', requireAuth, controller.getMyProfile);
router.put('/me', requireAuth, controller.updateMyProfile);

module.exports = router;