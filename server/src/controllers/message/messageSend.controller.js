import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { isUserOnline } from "../../socket/socket.js";
import { notifyMessageRecipients } from "../../utils/notification.js";
import { buildSafeHtml, normalizeStoredText } from "../../utils/sanitizeText.js";
import {
  MAX_TEXT_LENGTH,
  canUserSendToConversation,
  deleteRequestFiles,
  emitToConversation,
  emitToOtherConversationParticipants,
  findUserConversation,
  getInitialMessageStatus,
  getRecipientIds,
  isValidObjectId,
  normalizeClientMessageId,
  normalizeMessageAttachments,
  populateMessage,
} from "./message.helpers.js";

export const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId, replyTo } = req.body || {};
  const clientMessageId = normalizeClientMessageId(req.body?.clientMessageId);
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

  if (clientMessageId) {
    const now = new Date().toISOString();
    const sender = {
      _id: req.user._id.toString(),
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
    };

    emitToOtherConversationParticipants(
      conversation,
      req.user._id,
      "message:pending",
      {
        conversationId: conversation._id.toString(),
        clientMessageId,
        message: {
          _id: `pending-${clientMessageId}`,
          clientMessageId,
          conversation: conversation._id.toString(),
          sender,
          text,
          safeHtml: buildSafeHtml(text),
          attachments,
          status: "sending",
          readBy: [req.user._id.toString()],
          deliveredTo: [],
          reactions: [],
          replyTo: null,
          isEdited: false,
          deletedFor: [],
          deletedForEveryone: false,
          isPending: true,
          createdAt: now,
          updatedAt: now,
        },
      }
    );
  }

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
    $set: {
      lastMessage: message._id,
    },
    $pull: {
      hiddenFor: {
        $in: conversation.participants,
      },
    },
  });

  const populatedMessage = await populateMessage(Message.findById(message._id));
  const messagePayload = {
    ...populatedMessage.toObject(),
    clientMessageId,
  };

  emitToConversation(conversation, "message:new", {
    conversationId: conversation._id.toString(),
    message: messagePayload,
  });

  await notifyMessageRecipients({
    conversation,
    sender: req.user,
    message: populatedMessage,
  });

  res.status(201).json({
    message: messagePayload,
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
