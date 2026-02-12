const Notification = require('../models/Notification');

// @desc    Get User Notifications (Feed)
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    // Security: Clamp limit to max 50
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50); 
    const skip = (page - 1) * limit;

    // Fetch Notifications (Lean for performance)
    const notifications = await Notification.find({ userId: req.user })
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean();

    // Get count of unread notifications for badge UI
    const unreadCount = await Notification.countDocuments({ 
      userId: req.user, 
      isRead: false 
    });

    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Mark Notification as Read
// @route   PATCH /api/notifications/:id/read
// @access  Private
exports.markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    // Security Check: Verify ownership
    if (notification.userId.toString() !== req.user.toString()) {
      return res.status(403).json({ success: false, error: 'Unauthorized access' });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ success: true, data: notification });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Mark ALL Notifications as Read
// @route   PATCH /api/notifications/read-all
// @access  Private
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};