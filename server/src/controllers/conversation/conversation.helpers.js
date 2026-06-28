import mongoose from "mongoose";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import { getIO } from "../../socket/socket.js";

export const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
export const MAX_GROUP_NAME_LENGTH = 80;

export const buildDirectConversationKey = (userIds) =>
  `dm:${userIds.map((id) => id.toString()).sort().join(":")}`;

export const buildSelfConversationKey = (userId) => `self:${userId.toString()}`;

export const populateConversation = (query) =>
  query
    .populate("participants", "-password")
    .populate("admin", "name email avatar")
    .populate("admins", "name email avatar")
    .populate("memberRoles.user", "name email avatar")
    .populate("archivedBy", "name email avatar")
    .populate("deletedBy", "name email avatar")
    .populate("lastMessage");

export const toIdString = (value) => value?._id?.toString() || value?.toString();

export const uniqueIdStrings = (values = []) =>
  Array.from(
    new Set(
      values
        .map(toIdString)
        .filter((value) => typeof value === "string" && value)
    )
  );

export const hasParticipant = (conversation, userId) => {
  const targetUserId = userId.toString();

  return conversation.participants.some(
    (participant) => toIdString(participant) === targetUserId
  );
};

export const getGroupOwnerId = (conversation) =>
  toIdString(conversation.admin) ||
  toIdString(conversation.admins?.[0]) ||
  toIdString(conversation.participants?.[0]);

export const isGroupOwner = (conversation, userId) => {
  const ownerId = getGroupOwnerId(conversation);

  return Boolean(ownerId && ownerId === userId.toString());
};

export const isGroupAdmin = (conversation, userId) => {
  const targetUserId = userId.toString();
  const adminIds = uniqueIdStrings([
    conversation.admin,
    ...(conversation.admins || []),
    ...(conversation.memberRoles || [])
      .filter((memberRole) =>
        ["owner", "admin"].includes(memberRole.role)
      )
      .map((memberRole) => memberRole.user),
  ]);

  return adminIds.includes(targetUserId);
};

export const syncGroupRoles = async (conversation, assignedBy = null) => {
  if (!conversation?.isGroup) {
    return conversation;
  }

  const participantIds = uniqueIdStrings(conversation.participants);
  const ownerId = getGroupOwnerId(conversation);

  if (!ownerId || !participantIds.includes(ownerId)) {
    conversation.admin = participantIds[0] || null;
  }

  const nextOwnerId = getGroupOwnerId(conversation);
  const adminIds = uniqueIdStrings([nextOwnerId, ...(conversation.admins || [])])
    .filter((adminId) => participantIds.includes(adminId));

  conversation.admin = nextOwnerId || null;
  conversation.admins = adminIds;
  conversation.memberRoles = participantIds.map((participantId) => {
    const currentRole = (conversation.memberRoles || []).find(
      (memberRole) => toIdString(memberRole.user) === participantId
    );

    return {
      user: participantId,
      role:
        participantId === nextOwnerId
          ? "owner"
          : adminIds.includes(participantId)
            ? "admin"
            : "member",
      assignedBy: currentRole?.assignedBy || assignedBy || nextOwnerId,
      assignedAt: currentRole?.assignedAt || new Date(),
    };
  });

  await conversation.save();
  return conversation;
};

export const canEditGroupInfo = (conversation, userId) => {
  if (conversation.settings?.onlyAdminsCanEditGroupInfo === false) {
    return hasParticipant(conversation, userId);
  }

  return isGroupAdmin(conversation, userId);
};

export const canAddGroupMembers = (conversation, userId) => {
  if (conversation.settings?.onlyAdminsCanAddMembers === false) {
    return hasParticipant(conversation, userId);
  }

  return isGroupAdmin(conversation, userId);
};

export const emitConversationToParticipants = (conversation, eventName) => {
  const io = getIO();

  if (!io) {
    return;
  }

  conversation.participants.forEach((participant) => {
    const participantId = participant._id?.toString() || participant.toString();

    io.to(`user:${participantId}`).emit(eventName, {
      conversation,
    });
  });
};

export const emitConversationToUser = (userId, eventName, payload) => {
  const io = getIO();

  if (!io) {
    return;
  }

  io.to(`user:${userId.toString()}`).emit(eventName, payload);
};

export const revealConversationForUser = async (conversationId, userId) => {
  await Conversation.findByIdAndUpdate(conversationId, {
    $pull: {
      hiddenFor: userId,
    },
  });
};

export const normalizeGroupName = (groupName) =>
  typeof groupName === "string" ? groupName.trim() : "";

export const normalizeParticipantIds = (participantIds) => {
  if (!Array.isArray(participantIds)) {
    return [];
  }

  return Array.from(
    new Set(
      participantIds
        .filter((participantId) => typeof participantId === "string")
        .map((participantId) => participantId.trim())
        .filter(Boolean)
    )
  );
};

export const findGroupForAdmin = async (conversationId, userId) => {
  const conversation = await findUserGroup(conversationId, userId);

  if (!conversation) {
    return null;
  }

  await syncGroupRoles(conversation, userId);

  if (!isGroupAdmin(conversation, userId)) {
    return null;
  }

  return conversation;
};

export const findGroupForOwner = async (conversationId, userId) => {
  const conversation = await findUserGroup(conversationId, userId);

  if (!conversation) {
    return null;
  }

  await syncGroupRoles(conversation, userId);

  if (!isGroupOwner(conversation, userId)) {
    return null;
  }

  return conversation;
};

export const findUserGroup = async (conversationId, userId) => {
  if (!isValidObjectId(conversationId)) {
    return null;
  }

  return Conversation.findOne({
    _id: conversationId,
    isGroup: true,
    participants: userId,
    deletedAt: null,
  });
};

export const findOrCreateConversation = async ({
  conversationKey,
  legacyQuery,
  participants,
  isSelf,
  revealFor = null,
}) => {
  let conversation =
    (await Conversation.findOne({ conversationKey })) ||
    (await Conversation.findOne(legacyQuery));

  if (conversation) {
    if (!conversation.conversationKey) {
      conversation.conversationKey = conversationKey;
      await conversation.save();
    }

    if (revealFor) {
      await revealConversationForUser(conversation._id, revealFor);
    }

    return populateConversation(Conversation.findById(conversation._id));
  }

  try {
    conversation = await Conversation.create({
      conversationKey,
      participants,
      isGroup: false,
      isSelf,
    });
  } catch (err) {
    if (err.code === 11000) {
      return populateConversation(Conversation.findOne({ conversationKey }));
    }

    throw err;
  }

  return populateConversation(Conversation.findById(conversation._id));
};
