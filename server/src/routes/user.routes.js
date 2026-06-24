import express from "express";
import {
  blockUser,
  getBlockedUsers,
  reportUser,
  searchUsers,
  unblockUser,
} from "../controllers/user.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, searchUsers);
router.get("/blocks", protectRoute, getBlockedUsers);
router.post("/:userId/block", protectRoute, blockUser);
router.delete("/:userId/block", protectRoute, unblockUser);
router.post("/:userId/report", protectRoute, reportUser);

export default router;
