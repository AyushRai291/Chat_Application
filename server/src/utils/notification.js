import Notification from "../models/Notification.js";
import { getIO } from "../socket/socket.js";

const toIdString = (value) => value?._id?.toString() || value?.toString();

const getActorName = (actor) => actor?.name || actor?.email || "Someone";

const getMessagePreview = (message) => {
  const text = typeof message?.text === "string" ? message.text.trim() : "";

  if (text) {
    return text.length > 120 ? `${text.slice(0, 120)}...` : text;
  }

  const attachmentCount = Array.isArray(message?.attachments)
    ? message.attachments.length
    : 0;

  if (attachmentCount === 1) {
    return "Sent an attachment";
  }

  if (attachmentCount > 1) {
    return `Sent ${attachmentCount} attachments`;
  }

  return "";
};

const populateNotification = (query) =>
  query
    .populate("actor", "name email avatar")
    .populate({
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
    })
    .populate("message", "text attachments deletedForEveryone createdAt");

export const createNotification = async ({
  recipient,
  actor = null,
  type,
  conversation = null,
  message = null,
  title,
  body = "",
  metadata = {},
}) => {
  const recipientId = toIdString(recipient);
  const actorId = actor ? toIdString(actor) : null;

  if (!recipientId || (actorId && recipientId === actorId)) {
    return null;
  }

  const notification = await Notification.create({
    recipient: recipientId,
    actor: actorId,
    type,
    conversation: conversation ? toIdString(conversation) : null,
    message: message ? toIdString(message) : null,
    title,
    body,
    metadata,
  });

  const populatedNotification = await populateNotification(
    Notification.findById(notification._id)
  );
  const payload = populatedNotification.toObject();
  const io = getIO();

  if (io) {
    io.to(`user:${recipientId}`).emit("notification:new", {
      notification: payload,
    });
  }

  return payload;
};

export const notifyMessageRecipients = async ({
  conversation,
  sender,
  message,
}) => {
  const senderId = toIdString(sender);

  if (!conversation || conversation.isSelf) {
    return [];
  }

  const recipients = conversation.participants.filter(
    (participantId) => toIdString(participantId) !== senderId
  );

  return Promise.all(
    recipients.map((recipient) =>
      createNotification({
        recipient,
        actor: sender,
        type: "message",
        conversation,
        message,
        title: `${getActorName(sender)} sent a message`,
        body: getMessagePreview(message),
      })
    )
  );
};

export const notifyReactionRecipient = async ({
  recipient,
  actor,
  conversation,
  message,
  emoji,
}) => {
  return createNotification({
    recipient,
    actor,
    type: "reaction",
    conversation,
    message,
    title: `${getActorName(actor)} reacted to your message`,
    body: `${emoji} ${getMessagePreview(message)}`.trim(),
  });
};
