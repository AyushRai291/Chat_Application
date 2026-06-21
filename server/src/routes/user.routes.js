import express from "express";
import { searchUsers } from "../controllers/user.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, searchUsers);

export default router;