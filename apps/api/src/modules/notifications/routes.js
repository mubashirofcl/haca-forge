import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as notificationService from './service.js';

const router = Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { unreadOnly, page, limit } = req.query;
    const result = await notificationService.getUserNotifications(req.user._id, {
      unreadOnly: unreadOnly === 'true',
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const updated = await notificationService.markAsRead(req.params.id, req.user._id);
    return res.status(200).json({ notification: updated });
  } catch (err) {
    next(err);
  }
});

router.patch('/read-all', async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user._id);
    return res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

export default router;
