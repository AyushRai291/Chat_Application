import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import {
  MAX_FILE_SIZE,
  MAX_FILES,
  allowedMimeTypes,
  uploadsDir,
} from "../../middlewares/upload.middleware.js";
import { hasBlockedDirectParticipant } from "../../utils/blocking.js";
import { getIO } from "../../socket/socket.js";

export const DEFAULT_MESSAGE_LIMIT = 30;
export const MAX_MESSAGE_LIMIT = 50;
export const MAX_TEXT_LENGTH = 5000;
export const MAX_SEARCH_LIMIT = 25;
export const UPLOAD_URL_PREFIX = "/uploads/";

export const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const toIdString = (value) => value?._id?.toString() || value?.toString();

export const normalizeLimit = (limit) => {
  const parsedLimit = Number.parseInt(limit, 10);

  if (Number.isNaN(parsedLimit)) {
    return DEFAULT_MESSAGE_LIMIT;
  }

  return Math.min(Math.max(parsedLimit, 1), MAX_MESSAGE_LIMIT);
};

export const normalizeSearchLimit = (limit) => {
  const parsedLimit = Number.parseInt(limit, 10);

  if (Number.isNaN(parsedLimit)) {
    return MAX_SEARCH_LIMIT;
  }

  return Math.min(Math.max(parsedLimit, 1), MAX_SEARCH_LIMIT);
};

export const createRequestError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const getSafeUploadFilePath = (publicId) => {
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

export const normalizeAttachment = async (attachment) => {
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

export const normalizeMessageAttachments = async (attachments) => {
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

export const deleteAttachmentFiles = async (attachments = []) => {
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

export const deleteRequestFiles = async (files = []) => {
  await deleteAttachmentFiles(
    files.map((file) => ({
      publicId: file.filename,
    }))
  );
};

export const populateMessage = (query) =>
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

export const populateSearchMessage = (query) =>
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

export const findUserConversation = (conversationId, userId) =>
  Conversation.findOne({
    _id: conversationId,
    participants: userId,
    deletedAt: null,
  });

export const isConversationAdmin = (conversation, userId) => {
  const targetUserId = userId.toString();
  const adminIds = new Set([
    toIdString(conversation.admin),
    ...(conversation.admins || []).map(toIdString),
    ...(conversation.memberRoles || [])
      .filter((memberRole) => ["owner", "admin"].includes(memberRole.role))
      .map((memberRole) => toIdString(memberRole.user)),
  ].filter(Boolean));

  return adminIds.has(targetUserId);
};

export const canUserSendToConversation = async ({ conversation, userId }) => {
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

export const emitToConversation = (conversation, eventName, payload) => {
  const io = getIO();

  if (!io) {
    return;
  }

  conversation.participants.forEach((participantId) => {
    io.to(`user:${participantId.toString()}`).emit(eventName, payload);
  });
};

export const emitToOtherConversationParticipants = (
  conversation,
  senderId,
  eventName,
  payload
) => {
  const io = getIO();

  if (!io) {
    return;
  }

  const senderIdString = senderId.toString();

  conversation.participants.forEach((participantId) => {
    const participantIdString = participantId.toString();

    if (participantIdString === senderIdString) {
      return;
    }

    io.to(`user:${participantIdString}`).emit(eventName, payload);
  });
};

export const normalizeClientMessageId = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
};

export const getMessageWithConversation = async ({ messageId, userId }) => {
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

export const getRecipientIds = (conversation, senderId) =>
  conversation.participants
    .map((participantId) => participantId.toString())
    .filter((participantId) => participantId !== senderId.toString());

export const getInitialMessageStatus = ({ recipientIds, deliveredTo, readBy }) => {
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
