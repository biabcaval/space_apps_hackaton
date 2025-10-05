import express from 'express';
import NotificationController from '../controllers/NotificationController.js';

const router = express.Router();

router.post('/notifications/register', NotificationController.registerUser);
router.put('/notifications/preferences/:userId', NotificationController.updatePreferences);
router.get('/notifications/history/:userId', NotificationController.getHistory);
router.post('/notifications/test/:userId', NotificationController.sendTestNotification);

export default router;