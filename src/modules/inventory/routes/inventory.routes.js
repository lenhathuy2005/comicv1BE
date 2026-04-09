const express = require('express');
const controller = require('../controllers/inventory.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/me', requireAuth, controller.getMyInventory);
router.post('/use', requireAuth, controller.useItem);

module.exports = router;