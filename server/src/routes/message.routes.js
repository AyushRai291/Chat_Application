import express from "express";
import {
  deleteMessageForEveryone,
  deleteMessageForMe,
  editMessage,
  getMessages,
  searchMessages,
  sendMessage,
  toggleReaction,
  uploadFiles,
} from "../controllers/message.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";
import { uploadMessageFiles } from "../middlewares/upload.middleware.js";

const router = express.Router();

router.get("/search", protectRoute, searchMessages);
router.get("/:conversationId", protectRoute, getMessages);
router.post("/", protectRoute, sendMessage);
router.post("/upload", protectRoute, uploadMessageFiles, uploadFiles);
router.patch("/:messageId", protectRoute, editMessage);
router.delete("/:messageId/for-me", protectRoute, deleteMessageForMe);
router.delete(
  "/:messageId/for-everyone",
  protectRoute,
  deleteMessageForEveryone
);
router.post("/:messageId/reactions", protectRoute, toggleReaction);

export default router;
