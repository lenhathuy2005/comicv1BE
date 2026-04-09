const express = require('express');

const authRoutes = require('./modules/auth/routes/auth.routes');
const userRoutes = require('./modules/users/routes/user.routes');
const comicRoutes = require('./modules/comics/routes/comic.routes');
const guildRoutes = require('./modules/guilds/routes/guild.routes');
const vipRoutes = require('./modules/vip/routes/vip.routes');
const afkRoutes = require('./modules/afk/routes/afk.routes');
const shopRoutes = require('./modules/shop/routes/shop.routes');
const chatRoutes = require('./modules/chat/routes/chat.routes');
const notificationRoutes = require('./modules/notifications/routes/notification.routes');
const chapterRoutes = require('./modules/chapters/routes/chapter.routes');
const rankingRoutes = require('./modules/rankings/routes/ranking.routes');
const adminRoutes = require('./modules/admin/routes/admin.routes');
const commentRoutes = require('./modules/comments/routes/comment.routes');
const missionRoutes = require('./modules/missions/routes/mission.routes');
const checkinRoutes = require('./modules/checkin/routes/checkin.routes');
const profileRoutes = require('./modules/profile/routes/profile.routes');
const inventoryRoutes = require('./modules/inventory/routes/inventory.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/comics', comicRoutes);
router.use('/guilds', guildRoutes);
router.use('/vip', vipRoutes);
router.use('/afk', afkRoutes);
router.use('/shop', shopRoutes);
router.use('/chat', chatRoutes);
router.use('/notifications', notificationRoutes);
router.use('/chapters', chapterRoutes);
router.use('/rankings', rankingRoutes);
router.use('/admin', adminRoutes);
router.use('/comments', commentRoutes);
router.use('/profile', profileRoutes);
router.use('/missions', missionRoutes);
router.use('/checkin', checkinRoutes);
router.use('/inventory', inventoryRoutes);

module.exports = router;