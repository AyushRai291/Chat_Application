import express from "express";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notification.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, getNotifications);
router.patch("/read-all", protectRoute, markAllNotificationsRead);
router.patch("/:notificationId/read", protectRoute, markNotificationRead);

export default router;
