const express = require('express');
const controller = require('../controllers/profile.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/me', requireAuth, controller.getMyProfile);
router.put('/me', requireAuth, controller.updateMyProfile);
router.get('/me/activities', requireAuth, controller.getMyActivities);
router.get('/me/follows', requireAuth, controller.getMyFollows);
router.get('/me/guild', requireAuth, controller.getMyGuild);

module.exports = router;
