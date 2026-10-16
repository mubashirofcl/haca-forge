import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as notificationService from './service.js';

const router = Router();

router.use(authenticate);

// Get user notifications with filtering and pagination
router.get('/', async (req, res, next) => {
  try {
    const { unreadOnly, type, page, limit } = req.query;
    const result = await notificationService.getUserNotifications(req.user._id, {
      unreadOnly: unreadOnly === 'true',
      type: type || null,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// Get user notification preferences
router.get('/preferences', async (req, res, next) => {
  try {
    const preferences = await notificationService.getUserPreferences(req.user._id);
    return res.status(200).json({ preferences });
  } catch (err) {
    next(err);
  }
});

// Update user notification preferences
router.put('/preferences', async (req, res, next) => {
  try {
    const preferences = await notificationService.updateUserPreferences(
      req.user._id,
      req.body.preferences || req.body
    );
    return res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully.',
      preferences,
    });
  } catch (err) {
    next(err);
  }
});

// Mark single notification as read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const updated = await notificationService.markAsRead(req.params.id, req.user._id);
    if (!updated) {
      return res.status(404).json({ error: { message: 'Notification not found' } });
    }
    return res.status(200).json({ notification: updated });
  } catch (err) {
    next(err);
  }
});

// Mark all notifications as read
router.patch('/read-all', async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user._id);
    return res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

// Delete a notification
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await notificationService.deleteNotification(req.params.id, req.user._id);
    if (!deleted) {
      return res.status(404).json({ error: { message: 'Notification not found' } });
    }
    return res.status(200).json({ success: true, message: 'Notification deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
