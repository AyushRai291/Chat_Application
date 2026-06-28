import Message from "../../models/Message.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getIO } from "../../socket/socket.js";
import { notifyReactionRecipient } from "../../utils/notification.js";
import { buildSafeHtml, normalizeStoredText } from "../../utils/sanitizeText.js";
import {
  MAX_TEXT_LENGTH,
  deleteAttachmentFiles,
  emitToConversation,
  getMessageWithConversation,
  populateMessage,
} from "./message.helpers.js";

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
