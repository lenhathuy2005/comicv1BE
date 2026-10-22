const express = require('express');
const controller = require('../controllers/mission.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/me', requireAuth, controller.listMyMissions);
router.post('/:id/claim', requireAuth, controller.claimMissionReward);

module.exports = router;