import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const DEFAULT_NOTIFICATION_LIMIT = 20;
const MAX_NOTIFICATION_LIMIT = 50;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const normalizeLimit = (limit) => {
  const parsedLimit = Number.parseInt(limit, 10);

  if (Number.isNaN(parsedLimit)) {
    return DEFAULT_NOTIFICATION_LIMIT;
  }

  return Math.min(Math.max(parsedLimit, 1), MAX_NOTIFICATION_LIMIT);
};

const populateNotification = (query) =>
  query
    .populate("actor", "name email avatar")
    .populate({
      path: "conversation",
      populate: [
        {
          path: "participants",
          select: "name email avatar isOnline lastSeen",
        },
        {
          path: "admin",
          select: "name email avatar",
        },
      ],
    })
    .populate("message", "text attachments deletedForEveryone createdAt");

export const getNotifications = asyncHandler(async (req, res) => {
  const limit = normalizeLimit(req.query.limit);
  const unreadOnly = req.query.unreadOnly === "true";
  const query = {
    recipient: req.user._id,
  };

  if (unreadOnly) {
    query.isRead = false;
  }

  const [notifications, unreadCount] = await Promise.all([
    populateNotification(
      Notification.find(query).sort({ createdAt: -1 }).limit(limit)
    ),
    Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    }),
  ]);

  res.status(200).json({
    notifications,
    unreadCount,
    pagination: {
      limit,
      hasMore: notifications.length === limit,
    },
  });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  if (!isValidObjectId(notificationId)) {
    return res.status(400).json({
      message: "Invalid notification ID",
    });
  }

  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: req.user._id,
  });

  if (!notification) {
    return res.status(404).json({
      message: "Notification not found",
    });
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  const populatedNotification = await populateNotification(
    Notification.findById(notification._id)
  );
  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  res.status(200).json({
    notification: populatedNotification,
    unreadCount,
  });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    {
      recipient: req.user._id,
      isRead: false,
    },
    {
      isRead: true,
      readAt: new Date(),
    }
  );

  res.status(200).json({
    modifiedCount: result.modifiedCount,
    unreadCount: 0,
  });
});
