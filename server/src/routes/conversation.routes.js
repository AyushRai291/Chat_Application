import express from "express";
import {
  addGroupParticipant,
  archiveGroupConversation,
  createConversation,
  createGroupConversation,
  deleteGroupConversation,
  demoteGroupAdmin,
  getConversations,
  leaveGroupConversation,
  promoteGroupAdmin,
  removeGroupParticipant,
  transferGroupOwner,
  unarchiveGroupConversation,
  updateGroupConversation,
  updateGroupSettings,
} from "../controllers/conversation.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, getConversations);
router.post("/", protectRoute, createConversation);
router.post("/groups", protectRoute, createGroupConversation);
router.patch("/:conversationId/group", protectRoute, updateGroupConversation);
router.patch("/:conversationId/group/settings", protectRoute, updateGroupSettings);
router.post(
  "/:conversationId/admins/:participantId",
  protectRoute,
  promoteGroupAdmin
);
router.delete(
  "/:conversationId/admins/:participantId",
  protectRoute,
  demoteGroupAdmin
);
router.patch("/:conversationId/owner", protectRoute, transferGroupOwner);
router.post("/:conversationId/archive", protectRoute, archiveGroupConversation);
router.post(
  "/:conversationId/unarchive",
  protectRoute,
  unarchiveGroupConversation
);
router.post("/:conversationId/participants", protectRoute, addGroupParticipant);
router.delete(
  "/:conversationId/participants/:participantId",
  protectRoute,
  removeGroupParticipant
);
router.post("/:conversationId/leave", protectRoute, leaveGroupConversation);
router.delete("/:conversationId", protectRoute, deleteGroupConversation);

export default router;
