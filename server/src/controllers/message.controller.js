import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import {
  MAX_FILE_SIZE,
  MAX_FILES,
  allowedMimeTypes,
  uploadsDir,
} from "../middlewares/upload.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { hasBlockedDirectParticipant } from "../utils/blocking.js";
import { getIO, isUserOnline } from "../socket/socket.js";
import {
  notifyMessageRecipients,
  notifyReactionRecipient,
} from "../utils/notification.js";
import { buildSafeHtml, normalizeStoredText } from "../utils/sanitizeText.js";

const DEFAULT_MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LIMIT = 50;
const MAX_TEXT_LENGTH = 5000;
const MAX_SEARCH_LIMIT = 25;
const UPLOAD_URL_PREFIX = "/uploads/";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toIdString = (value) => value?._id?.toString() || value?.toString();

const normalizeLimit = (limit) => {
  const parsedLimit = Number.parseInt(limit, 10);

  if (Number.isNaN(parsedLimit)) {
    return DEFAULT_MESSAGE_LIMIT;
  }

  return Math.min(Math.max(parsedLimit, 1), MAX_MESSAGE_LIMIT);
};

const normalizeSearchLimit = (limit) => {
  const parsedLimit = Number.parseInt(limit, 10);

  if (Number.isNaN(parsedLimit)) {
    return MAX_SEARCH_LIMIT;
  }

  return Math.min(Math.max(parsedLimit, 1), MAX_SEARCH_LIMIT);
};

const createRequestError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getSafeUploadFilePath = (publicId) => {
  const fileName = typeof publicId === "string" ? publicId.trim() : "";
  const baseName = path.basename(fileName);

  if (!baseName || baseName !== fileName) {
    return null;
  }

  const uploadsRoot = path.resolve(uploadsDir);
  const filePath = path.resolve(uploadsRoot, baseName);

  if (!filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return null;
  }

  return filePath;
};

const normalizeAttachment = async (attachment) => {
  if (!attachment || typeof attachment !== "object") {
    throw createRequestError(400, "Invalid attachment metadata");
  }

  const publicId =
    typeof attachment.publicId === "string" ? attachment.publicId.trim() : "";
  const url = typeof attachment.url === "string" ? attachment.url.trim() : "";
  const fileName =
    typeof attachment.fileName === "string" ? attachment.fileName.trim() : "";
  const fileType =
    typeof attachment.fileType === "string" ? attachment.fileType.trim() : "";
  const fileSize = Number(attachment.fileSize);

  if (!publicId || !url || !fileName || !fileType) {
    throw createRequestError(400, "Invalid attachment metadata");
  }

  if (fileName.length > 255) {
    throw createRequestError(400, "Attachment file name is too long");
  }

  if (url !== `${UPLOAD_URL_PREFIX}${publicId}`) {
    throw createRequestError(400, "Invalid attachment URL");
  }

  if (!allowedMimeTypes.has(fileType)) {
    throw createRequestError(400, "Unsupported attachment type");
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw createRequestError(400, "Invalid attachment file size");
  }

  if (fileSize > MAX_FILE_SIZE) {
    throw createRequestError(413, "File size cannot exceed 10MB.");
  }

  const filePath = getSafeUploadFilePath(publicId);

  if (!filePath) {
    throw createRequestError(400, "Invalid attachment file");
  }

  try {
    await fs.access(filePath);
  } catch {
    throw createRequestError(
      400,
      "Uploaded file is no longer available. Please upload it again."
    );
  }

  return {
    url,
    publicId,
    fileName,
    fileType,
    fileSize,
  };
};

const normalizeMessageAttachments = async (attachments) => {
  if (!Array.isArray(attachments)) {
    return [];
  }

  if (attachments.length > MAX_FILES) {
    throw createRequestError(400, "Maximum 5 files allowed.");
  }

  const normalizedAttachments = [];

  for (const attachment of attachments) {
    normalizedAttachments.push(await normalizeAttachment(attachment));
  }

  return normalizedAttachments;
};

const deleteAttachmentFiles = async (attachments = []) => {
  await Promise.all(
    attachments.map(async (attachment) => {
      const filePath = getSafeUploadFilePath(attachment.publicId);

      if (!filePath) {
        return;
      }

      try {
        await fs.unlink(filePath);
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error("Attachment cleanup failed:", err.message);
        }
      }
    })
  );
};

const deleteRequestFiles = async (files = []) => {
  await deleteAttachmentFiles(
    files.map((file) => ({
      publicId: file.filename,
    }))
  );
};

const populateMessage = (query) =>
  query
    .populate("sender", "name email avatar")
    .populate("reactions.user", "name email avatar")
    .populate({
      path: "replyTo",
      select: "text safeHtml sender createdAt deletedForEveryone",
      populate: {
        path: "sender",
        select: "name email avatar",
      },
    });

const populateSearchMessage = (query) =>
  populateMessage(query).populate({
    path: "conversation",
    populate: [
      {
        path: "participants",
        select: "name email avatar isOnline lastSeen",
      },
      {
        path: "admin",
        select: "name email avatar",
      },
    ],
  });

const findUserConversation = (conversationId, userId) =>
  Conversation.findOne({
    _id: conversationId,
    participants: userId,
    deletedAt: null,
  });

const isConversationAdmin = (conversation, userId) => {
  const targetUserId = userId.toString();
  const adminIds = new Set([
    toIdString(conversation.admin),
    ...(conversation.admins || []).map(toIdString),
    ...(conversation.memberRoles || [])
      .filter((memberRole) =>
        ["owner", "admin"].includes(memberRole.role)
      )
      .map((memberRole) => toIdString(memberRole.user)),
  ].filter(Boolean));

  return adminIds.has(targetUserId);
};

const canUserSendToConversation = async ({ conversation, userId }) => {
  if (conversation.isArchived) {
    return {
      allowed: false,
      status: 400,
      message: "Archived conversations are read-only",
    };
  }

  if (
    conversation.isGroup &&
    conversation.settings?.onlyAdminsCanSendMessages &&
    !isConversationAdmin(conversation, userId)
  ) {
    return {
      allowed: false,
      status: 403,
      message: "Only group admins can send messages in this group",
    };
  }

  if (await hasBlockedDirectParticipant({ conversation, userId })) {
    return {
      allowed: false,
      status: 403,
      message: "Message blocked by user privacy settings",
    };
  }

  return {
    allowed: true,
  };
};

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

  if (await hasBlockedDirectParticipant({ conversation, userId })) {
    return {
      error: {
        status: 403,
        message: "Action blocked by user privacy settings",
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

  if (await hasBlockedDirectParticipant({ conversation, userId: req.user._id })) {
    return res.status(403).json({
      message: "Conversation blocked by user privacy settings",
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

export const searchMessages = asyncHandler(async (req, res) => {
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";
  const conversationId =
    typeof req.query.conversationId === "string"
      ? req.query.conversationId.trim()
      : "";

  if (search.length < 2) {
    return res.status(400).json({
      message: "Search query must be at least 2 characters",
    });
  }

  const limit = normalizeSearchLimit(req.query.limit);
  const conversationQuery = {
    participants: req.user._id,
  };

  if (conversationId) {
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({
        message: "Invalid conversation ID",
      });
    }

    conversationQuery._id = conversationId;
  }

  const conversations = await Conversation.find({
    ...conversationQuery,
    deletedAt: null,
  }).select("_id participants isGroup isSelf");
  const accessibleConversations = [];

  for (const conversation of conversations) {
    if (!(await hasBlockedDirectParticipant({ conversation, userId: req.user._id }))) {
      accessibleConversations.push(conversation);
    }
  }

  const conversationIds = accessibleConversations.map(
    (conversation) => conversation._id
  );

  if (conversationIds.length === 0) {
    return res.status(200).json({
      messages: [],
      pagination: {
        limit,
        hasMore: false,
      },
    });
  }

  const escapedSearch = escapeRegex(search);
  const messageQuery = {
    conversation: { $in: conversationIds },
    deletedFor: { $ne: req.user._id },
    deletedForEveryone: false,
    $or: [
      { text: { $regex: escapedSearch, $options: "i" } },
      { "attachments.fileName": { $regex: escapedSearch, $options: "i" } },
    ],
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

  const searchResults = await populateSearchMessage(
    Message.find(messageQuery)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
  );
  const hasMore = searchResults.length > limit;
  const messages = searchResults.slice(0, limit);

  res.status(200).json({
    messages,
    pagination: {
      limit,
      hasMore,
    },
  });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId, replyTo } = req.body || {};
  const text =
    typeof req.body?.text === "string"
      ? normalizeStoredText(req.body.text)
      : "";
  const rawAttachments = Array.isArray(req.body?.attachments)
    ? req.body.attachments
    : [];
  let attachments = [];

  if (!isValidObjectId(conversationId)) {
    return res.status(400).json({
      message: "Invalid conversation ID",
    });
  }

  try {
    attachments = await normalizeMessageAttachments(rawAttachments);
  } catch (err) {
    return res.status(err.status || 400).json({
      message: err.message,
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

  const sendAccess = await canUserSendToConversation({
    conversation,
    userId: req.user._id,
  });

  if (!sendAccess.allowed) {
    return res.status(sendAccess.status).json({
      message: sendAccess.message,
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
    safeHtml: buildSafeHtml(text),
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

  await notifyMessageRecipients({
    conversation,
    sender: req.user,
    message: populatedMessage,
  });

  res.status(201).json({
    message: populatedMessage,
  });
});

export const uploadFiles = asyncHandler(async (req, res) => {
  const { conversationId } = req.body || {};
  const files = Array.isArray(req.files) ? req.files : [];

  if (!isValidObjectId(conversationId)) {
    await deleteRequestFiles(files);

    return res.status(400).json({
      message: "Invalid conversation ID",
    });
  }

  const conversation = await findUserConversation(conversationId, req.user._id);

  if (!conversation) {
    await deleteRequestFiles(files);

    return res.status(404).json({
      message: "Conversation not found",
    });
  }

  const uploadAccess = await canUserSendToConversation({
    conversation,
    userId: req.user._id,
  });

  if (!uploadAccess.allowed) {
    await deleteRequestFiles(files);

    return res.status(uploadAccess.status).json({
      message: uploadAccess.message,
    });
  }

  if (files.length === 0) {
    return res.status(400).json({
      message: "At least one file is required",
    });
  }

  const attachments = files.map((file) => ({
    url: `/uploads/${file.filename}`,
    publicId: file.filename,
    fileName: file.originalname,
    fileType: file.mimetype,
    fileSize: file.size,
  }));

  res.status(201).json({
    attachments,
  });
});

export const editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const text =
    typeof req.body?.text === "string"
      ? normalizeStoredText(req.body.text)
      : "";

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
  message.safeHtml = buildSafeHtml(text);
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

  const attachmentsToDelete = [...message.attachments];
  const updatedMessage = await Message.findByIdAndUpdate(
    message._id,
    {
      text: "",
      safeHtml: "",
      attachments: [],
      reactions: [],
      deletedForEveryone: true,
      isEdited: false,
    },
    {
      new: true,
    }
  );

  await deleteAttachmentFiles(attachmentsToDelete);

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
  const shouldAddReaction =
    !existingReaction || existingReaction.emoji !== emoji;

  message.reactions = message.reactions.filter(
    (reaction) => reaction.user.toString() !== currentUserId
  );

  if (shouldAddReaction) {
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

  if (shouldAddReaction) {
    await notifyReactionRecipient({
      recipient: message.sender,
      actor: req.user,
      conversation,
      message: populatedMessage,
      emoji,
    });
  }

  res.status(200).json({
    message: populatedMessage,
  });
});
