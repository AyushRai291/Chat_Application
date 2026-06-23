import express from "express";
import {
  addGroupParticipant,
  createConversation,
  createGroupConversation,
  getConversations,
  leaveGroupConversation,
  removeGroupParticipant,
  updateGroupConversation,
} from "../controllers/conversation.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, getConversations);
router.post("/", protectRoute, createConversation);
router.post("/groups", protectRoute, createGroupConversation);
router.patch("/:conversationId/group", protectRoute, updateGroupConversation);
router.post("/:conversationId/participants", protectRoute, addGroupParticipant);
router.delete(
  "/:conversationId/participants/:participantId",
  protectRoute,
  removeGroupParticipant
);
router.post("/:conversationId/leave", protectRoute, leaveGroupConversation);

export default router;
