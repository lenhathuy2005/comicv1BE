const express = require('express');
const controller = require('../controllers/comment.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

// public
router.get('/comic/:comicId', controller.listComicComments);
router.get('/chapter/:chapterId', controller.listChapterComments);

// user
router.get('/me', requireAuth, controller.listMyComments);
router.post('/', requireAuth, controller.createComment);
router.put('/:id', requireAuth, controller.updateMyComment);
router.delete('/:id', requireAuth, controller.deleteMyComment);

module.exports = router;