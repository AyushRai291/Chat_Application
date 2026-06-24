import mongoose from "mongoose";
import User from "../models/User.js";
import UserBlock from "../models/UserBlock.js";
import UserReport from "../models/UserReport.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getBlockedRelationshipUserIds } from "../utils/blocking.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const reportReasons = new Set([
  "spam",
  "harassment",
  "impersonation",
  "illegal",
  "other",
]);

export const searchUsers = asyncHandler(async (req, res) => {
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";
  const hiddenUserIds = await getBlockedRelationshipUserIds(req.user._id);

  const query = {
    _id: {
      $ne: req.user._id,
      $nin: hiddenUserIds,
    },
  };

  if (search) {
    const escapedSearch = escapeRegex(search);

    query.$or = [
      { name: { $regex: escapedSearch, $options: "i" } },
      { email: { $regex: escapedSearch, $options: "i" } },
    ];
  }

  const users = await User.find(query)
    .select("-password")
    .sort({ name: 1 })
    .limit(20);

  res.status(200).json({
    users,
  });
});

export const getBlockedUsers = asyncHandler(async (req, res) => {
  const blocks = await UserBlock.find({
    blocker: req.user._id,
  })
    .populate("blocked", "-password")
    .sort({ createdAt: -1 });

  res.status(200).json({
    blocks,
  });
});

export const blockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  if (!isValidObjectId(userId)) {
    return res.status(400).json({
      message: "Invalid user ID",
    });
  }

  if (userId === req.user._id.toString()) {
    return res.status(400).json({
      message: "You cannot block yourself",
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  const block = await UserBlock.findOneAndUpdate(
    {
      blocker: req.user._id,
      blocked: user._id,
    },
    {
      blocker: req.user._id,
      blocked: user._id,
      reason,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  ).populate("blocked", "-password");

  res.status(200).json({
    block,
  });
});

export const unblockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    return res.status(400).json({
      message: "Invalid user ID",
    });
  }

  await UserBlock.deleteOne({
    blocker: req.user._id,
    blocked: userId,
  });

  res.status(200).json({
    userId,
  });
});

export const reportUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.trim() : "other";
  const details =
    typeof req.body?.details === "string" ? req.body.details.trim() : "";
  const conversationId =
    typeof req.body?.conversationId === "string"
      ? req.body.conversationId.trim()
      : "";
  const messageId =
    typeof req.body?.messageId === "string" ? req.body.messageId.trim() : "";

  if (!isValidObjectId(userId)) {
    return res.status(400).json({
      message: "Invalid user ID",
    });
  }

  if (userId === req.user._id.toString()) {
    return res.status(400).json({
      message: "You cannot report yourself",
    });
  }

  if (!reportReasons.has(reason)) {
    return res.status(400).json({
      message: "Invalid report reason",
    });
  }

  if (conversationId && !isValidObjectId(conversationId)) {
    return res.status(400).json({
      message: "Invalid conversation ID",
    });
  }

  if (messageId && !isValidObjectId(messageId)) {
    return res.status(400).json({
      message: "Invalid message ID",
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  const report = await UserReport.create({
    reporter: req.user._id,
    reportedUser: user._id,
    conversation: conversationId || null,
    message: messageId || null,
    reason,
    details,
  });

  res.status(201).json({
    report,
  });
});
