import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getIO, isUserOnline } from "../socket/socket.js";

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
    .populate("reactions.user", "name email avatar")
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

const emitToConversation = (conversation, eventName, payload) => {
  const io = getIO();

  if (!io) {
    return;
  }

  conversation.participants.forEach((participantId) => {
    io.to(`user:${participantId.toString()}`).emit(eventName, payload);
  });
};

const getMessageWithConversation = async ({ messageId, userId }) => {
  if (!isValidObjectId(messageId)) {
    return {
      error: {
        status: 400,
        message: "Invalid message ID",
      },
    };
  }

  const message = await Message.findById(messageId);

  if (!message) {
    return {
      error: {
        status: 404,
        message: "Message not found",
      },
    };
  }

  const conversation = await findUserConversation(message.conversation, userId);

  if (!conversation) {
    return {
      error: {
        status: 404,
        message: "Message not found",
      },
    };
  }

  return {
    message,
    conversation,
  };
};

const getRecipientIds = (conversation, senderId) =>
  conversation.participants
    .map((participantId) => participantId.toString())
    .filter((participantId) => participantId !== senderId.toString());

const getInitialMessageStatus = ({ recipientIds, deliveredTo, readBy }) => {
  if (recipientIds.length === 0) {
    return "read";
  }

  const deliveredIds = new Set(deliveredTo.map((id) => id.toString()));
  const readIds = new Set(readBy.map((id) => id.toString()));

  if (recipientIds.every((participantId) => readIds.has(participantId))) {
    return "read";
  }

  if (recipientIds.every((participantId) => deliveredIds.has(participantId))) {
    return "delivered";
  }

  return "sent";
};

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

  const recipientIds = getRecipientIds(conversation, req.user._id);
  const deliveredTo = recipientIds.filter((participantId) =>
    isUserOnline(participantId)
  );
  const readBy = [req.user._id];
  const status = getInitialMessageStatus({
    recipientIds,
    deliveredTo,
    readBy,
  });

  const message = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    text,
    attachments,
    status,
    readBy,
    deliveredTo,
    replyTo: replyToMessageId,
  });

  await Conversation.findByIdAndUpdate(conversation._id, {
    lastMessage: message._id,
  });

  const populatedMessage = await populateMessage(Message.findById(message._id));

  emitToConversation(conversation, "message:new", {
    conversationId: conversation._id.toString(),
    message: populatedMessage.toObject(),
  });

  res.status(201).json({
    message: populatedMessage,
  });
});

export const editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

  if (!text) {
    return res.status(400).json({
      message: "Message text is required",
    });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({
      message: `Message text cannot exceed ${MAX_TEXT_LENGTH} characters`,
    });
  }

  const result = await getMessageWithConversation({
    messageId,
    userId: req.user._id,
  });

  if (result.error) {
    return res.status(result.error.status).json({
      message: result.error.message,
    });
  }

  const { message, conversation } = result;

  if (message.sender.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      message: "You can only edit your own messages",
    });
  }

  if (message.deletedForEveryone) {
    return res.status(400).json({
      message: "Deleted messages cannot be edited",
    });
  }

  message.text = text;
  message.isEdited = true;
  await message.save();

  const populatedMessage = await populateMessage(Message.findById(message._id));

  emitToConversation(conversation, "message:updated", {
    conversationId: conversation._id.toString(),
    message: populatedMessage.toObject(),
  });

  res.status(200).json({
    message: populatedMessage,
  });
});

export const deleteMessageForMe = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const result = await getMessageWithConversation({
    messageId,
    userId: req.user._id,
  });

  if (result.error) {
    return res.status(result.error.status).json({
      message: result.error.message,
    });
  }

  const { message, conversation } = result;

  await Message.findByIdAndUpdate(message._id, {
    $addToSet: {
      deletedFor: req.user._id,
    },
  });

  const io = getIO();

  if (io) {
    io.to(`user:${req.user._id.toString()}`).emit("message:deleted-for-me", {
      conversationId: conversation._id.toString(),
      messageId: message._id.toString(),
    });
  }

  res.status(200).json({
    messageId: message._id,
  });
});

export const deleteMessageForEveryone = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const result = await getMessageWithConversation({
    messageId,
    userId: req.user._id,
  });

  if (result.error) {
    return res.status(result.error.status).json({
      message: result.error.message,
    });
  }

  const { message, conversation } = result;

  if (message.sender.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      message: "You can only delete your own messages for everyone",
    });
  }

  const updatedMessage = await Message.findByIdAndUpdate(
    message._id,
    {
      text: "",
      attachments: [],
      reactions: [],
      deletedForEveryone: true,
      isEdited: false,
    },
    {
      new: true,
    }
  );

  const populatedMessage = await populateMessage(
    Message.findById(updatedMessage._id)
  );

  emitToConversation(conversation, "message:deleted-for-everyone", {
    conversationId: conversation._id.toString(),
    message: populatedMessage.toObject(),
  });

  res.status(200).json({
    message: populatedMessage,
  });
});

export const toggleReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const emoji = typeof req.body?.emoji === "string" ? req.body.emoji.trim() : "";

  if (!emoji) {
    return res.status(400).json({
      message: "Emoji is required",
    });
  }

  if (emoji.length > 16) {
    return res.status(400).json({
      message: "Emoji is too long",
    });
  }

  const result = await getMessageWithConversation({
    messageId,
    userId: req.user._id,
  });

  if (result.error) {
    return res.status(result.error.status).json({
      message: result.error.message,
    });
  }

  const { message, conversation } = result;

  if (message.deletedForEveryone) {
    return res.status(400).json({
      message: "Cannot react to a deleted message",
    });
  }

  const currentUserId = req.user._id.toString();
  const existingReaction = message.reactions.find(
    (reaction) => reaction.user.toString() === currentUserId
  );

  message.reactions = message.reactions.filter(
    (reaction) => reaction.user.toString() !== currentUserId
  );

  if (!existingReaction || existingReaction.emoji !== emoji) {
    message.reactions.push({
      user: req.user._id,
      emoji,
    });
  }

  await message.save();

  const populatedMessage = await populateMessage(Message.findById(message._id));

  emitToConversation(conversation, "message:reaction-updated", {
    conversationId: conversation._id.toString(),
    message: populatedMessage.toObject(),
  });

  res.status(200).json({
    message: populatedMessage,
  });
});
