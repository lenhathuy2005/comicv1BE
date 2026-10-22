const express = require('express');
const controller = require('../controllers/cultivation.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/me', requireAuth, controller.getMe);
router.get('/realms', requireAuth, controller.listRealms);
router.get('/levels', requireAuth, controller.listLevels);
router.get('/breakthrough-rules', requireAuth, controller.listBreakthroughRules);
router.post('/breakthrough', requireAuth, controller.attemptBreakthrough);

module.exports = router;
