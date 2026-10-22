const express = require('express');
const controller = require('../controllers/guild.controller');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/', controller.listGuilds);
router.get('/me', requireAuth, controller.getMyGuildProfile);
router.get('/creation-requirements', requireAuth, controller.getGuildCreationRequirements);
router.get('/:id/detail', requireAuth, controller.getGuildDetailAggregate);
router.get('/:id/members', requireAuth, controller.listGuildMembers);
router.get('/:id/join-requests', requireAuth, controller.listGuildJoinRequests);
router.get('/:id/logs', requireAuth, controller.listGuildLogs);
router.get('/:id/donations', requireAuth, controller.listGuildDonations);
router.get('/:id/announcements', requireAuth, controller.listGuildAnnouncements);
router.get('/:id', controller.getGuildDetail);

router.post('/', requireAuth, controller.createGuild);
router.post('/:id/join-requests', requireAuth, controller.requestJoinGuild);
router.post('/:id/cancel-request', requireAuth, controller.cancelJoinRequest);
router.post('/:id/leave', requireAuth, controller.leaveGuild);
router.post('/:id/disband', requireAuth, controller.disbandGuild);
router.post('/:id/checkin', requireAuth, controller.checkinGuild);
router.post('/:id/contribute', requireAuth, controller.contributeToGuild);
router.post('/join-requests/:requestId/approve', requireAuth, controller.approveJoinRequest);
router.post('/join-requests/:requestId/reject', requireAuth, controller.rejectJoinRequest);
router.post('/:id/donations', requireAuth, controller.donateToGuild);

router.put('/:id', requireAuth, controller.updateGuild);
router.post('/:id/members/:memberId/kick', requireAuth, controller.kickGuildMember);
router.put('/:id/members/:memberId/role', requireAuth, controller.updateGuildMemberRole);
router.put('/:id/announcement', requireAuth, controller.updateGuildAnnouncement);

module.exports = router;
