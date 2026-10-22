const express = require('express');
const controller = require('../controllers/admin.controller');
const { requireAuth, requireRole } = require('../../../middlewares/auth.middleware');
const upload = require('../../../middlewares/upload.middleware');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/dashboard', controller.dashboard);

router.get('/genres', controller.listGenres);
router.post('/genres', controller.createGenre);
router.put('/genres/:id', controller.updateGenre);
router.delete('/genres/:id', controller.deleteGenre);

router.get('/comments', controller.listComments);
router.patch('/comments/:id/status', controller.updateCommentStatus);
router.delete('/comments/:id', controller.deleteComment);

router.get('/users', controller.listUsers);
router.get('/users/:id', controller.getUserDetail);
router.post('/users', controller.createUser);
router.put('/users/:id', controller.updateUser);
router.delete('/users/:id', controller.deleteUser);

router.get('/guilds', controller.listGuilds);
router.post('/guilds', controller.createGuild);
router.put('/guilds/:id', controller.updateGuild);
router.delete('/guilds/:id', controller.deleteGuild);
router.post('/guild-roles', controller.createGuildRole);
router.put('/guild-roles/:id', controller.updateGuildRole);
router.delete('/guild-roles/:id', controller.deleteGuildRole);
router.post('/guild-join-requests/:id/approve', controller.approveGuildRequest);
router.post('/guild-join-requests/:id/reject', controller.rejectGuildRequest);

router.get('/cultivation', controller.listCultivation);
router.post('/realms', controller.createRealm);
router.put('/realms/:id', controller.updateRealm);
router.delete('/realms/:id', controller.deleteRealm);
router.post('/levels', controller.createLevel);
router.put('/levels/:id', controller.updateLevel);
router.delete('/levels/:id', controller.deleteLevel);

router.get('/missions', controller.listMissions);
router.post('/missions', controller.createMission);
router.put('/missions/:id', controller.updateMission);
router.delete('/missions/:id', controller.deleteMission);

router.get('/afk', controller.listAfk);
router.post('/afk/configs', controller.createAfkConfig);
router.put('/afk/configs/:id', controller.updateAfkConfig);
router.delete('/afk/configs/:id', controller.deleteAfkConfig);

router.get('/vip', controller.listVip);
router.post('/vip/levels', controller.createVipLevel);
router.put('/vip/levels/:id', controller.updateVipLevel);
router.delete('/vip/levels/:id', controller.deleteVipLevel);
router.post('/vip/benefits', controller.createVipBenefit);
router.put('/vip/benefits/:id', controller.updateVipBenefit);
router.delete('/vip/benefits/:id', controller.deleteVipBenefit);

router.get('/rankings', controller.getRankingOverview);
router.get('/rankings/:type', controller.getRankingList);
router.post('/rankings/:type/snapshot', controller.createRankingSnapshot);

router.get('/authors', controller.listAuthors);
router.get('/comics', controller.listComics);
router.post('/comics', upload.single('cover_image'), controller.createComic);
router.put('/comics/:id', upload.single('cover_image'), controller.updateComic);
router.delete('/comics/:id', controller.deleteComic);

router.get('/chapters', controller.listChapters);
router.get('/chapters/:id', controller.getChapterDetail);
router.post('/chapters', upload.array('images', 2000), controller.createChapter);
router.put('/chapters/:id', controller.updateChapter);
router.delete('/chapters/:id', controller.deleteChapter);

/* ảnh chapter */
router.post('/chapters/:id/images', upload.array('images', 2000), controller.addChapterImages);
router.put('/chapter-images/:imageId', upload.single('image'), controller.replaceChapterImage);
router.delete('/chapter-images/:imageId', controller.deleteChapterImage);
router.put('/chapters/:id/images/reorder', controller.reorderChapterImages);

module.exports = router;