import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getIO } from "../socket/socket.js";

const DEFAULT_MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LIMIT = 50;
const MAX_TEXT_LENGTH = 5000;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const normalizeLimit = (limit) => {
  const parsedLimit = Number.parseInt(limit, 10);

  if (Number.isNaN(parsedLimit)) {
    return DEFAULT_MESSAGE_LIMIT;
  }

  return Math.min(Math.max(parsedLimit, 1), MAX_MESSAGE_LIMIT);
};

const populateMessage = (query) =>
  query
    .populate("sender", "name email avatar")
    .populate({
      path: "replyTo",
      select: "text sender createdAt deletedForEveryone",
      populate: {
        path: "sender",
        select: "name email avatar",
      },
    });

const findUserConversation = (conversationId, userId) =>
  Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });

export const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  if (!isValidObjectId(conversationId)) {
    return res.status(400).json({
      message: "Invalid conversation ID",
    });
  }

  const conversation = await findUserConversation(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Conversation not found",
    });
  }

  const limit = normalizeLimit(req.query.limit);
  const messageQuery = {
    conversation: conversation._id,
    deletedFor: { $ne: req.user._id },
  };

  if (req.query.before) {
    const beforeDate = new Date(req.query.before);

    if (Number.isNaN(beforeDate.getTime())) {
      return res.status(400).json({
        message: "Invalid before cursor",
      });
    }

    messageQuery.createdAt = { $lt: beforeDate };
  }

  const messages = await populateMessage(
    Message.find(messageQuery).sort({ createdAt: -1 }).limit(limit)
  );

  messages.reverse();

  res.status(200).json({
    messages,
    pagination: {
      limit,
      hasMore: messages.length === limit,
    },
  });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId, replyTo } = req.body || {};
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const attachments = Array.isArray(req.body?.attachments)
    ? req.body.attachments
    : [];

  if (!isValidObjectId(conversationId)) {
    return res.status(400).json({
      message: "Invalid conversation ID",
    });
  }

  if (!text && attachments.length === 0) {
    return res.status(400).json({
      message: "Message text or attachment is required",
    });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({
      message: `Message text cannot exceed ${MAX_TEXT_LENGTH} characters`,
    });
  }

  const conversation = await findUserConversation(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Conversation not found",
    });
  }

  let replyToMessageId = null;

  if (replyTo) {
    if (!isValidObjectId(replyTo)) {
      return res.status(400).json({
        message: "Invalid reply message ID",
      });
    }

    const replyToMessage = await Message.findOne({
      _id: replyTo,
      conversation: conversation._id,
    });

    if (!replyToMessage) {
      return res.status(400).json({
        message: "Reply message must belong to this conversation",
      });
    }

    replyToMessageId = replyToMessage._id;
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    text,
    attachments,
    readBy: [req.user._id],
    replyTo: replyToMessageId,
  });

  await Conversation.findByIdAndUpdate(conversation._id, {
    lastMessage: message._id,
  });

  const populatedMessage = await populateMessage(Message.findById(message._id));

  // Message DB me save ho chuka hai.
  // Ab same message conversation ke participants ko realtime bhejna hai.
  const io = getIO();

  if (io) {
    const payload = {
      conversationId: conversation._id.toString(),
      message: populatedMessage.toObject(),
    };

    // Har participant apne personal socket room me hai: user:<userId>
    conversation.participants.forEach((participantId) => {
      io.to(`user:${participantId.toString()}`).emit("message:new", payload);
    });
  }

  res.status(201).json({
    message: populatedMessage,
  });
});
