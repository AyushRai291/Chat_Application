import express from "express";
import {
  getConversations,
  createConversation,
} from "../controllers/conversation.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, getConversations);
router.post("/", protectRoute, createConversation);

export default router;