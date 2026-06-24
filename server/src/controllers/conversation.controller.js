import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import "../models/Message.js";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { hasUserBlock } from "../utils/blocking.js";
import { getIO } from "../socket/socket.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const MAX_GROUP_NAME_LENGTH = 80;

const buildDirectConversationKey = (userIds) =>
  `dm:${userIds.map((id) => id.toString()).sort().join(":")}`;

const buildSelfConversationKey = (userId) => `self:${userId.toString()}`;

const populateConversation = (query) =>
  query
    .populate("participants", "-password")
    .populate("admin", "name email avatar")
    .populate("admins", "name email avatar")
    .populate("memberRoles.user", "name email avatar")
    .populate("archivedBy", "name email avatar")
    .populate("deletedBy", "name email avatar")
    .populate("lastMessage");

const toIdString = (value) => value?._id?.toString() || value?.toString();

const uniqueIdStrings = (values = []) =>
  Array.from(
    new Set(
      values
        .map(toIdString)
        .filter((value) => typeof value === "string" && value)
    )
  );

const hasParticipant = (conversation, userId) => {
  const targetUserId = userId.toString();

  return conversation.participants.some(
    (participant) => toIdString(participant) === targetUserId
  );
};

const getGroupOwnerId = (conversation) =>
  toIdString(conversation.admin) ||
  toIdString(conversation.admins?.[0]) ||
  toIdString(conversation.participants?.[0]);

const isGroupOwner = (conversation, userId) => {
  const ownerId = getGroupOwnerId(conversation);

  return Boolean(ownerId && ownerId === userId.toString());
};

const isGroupAdmin = (conversation, userId) => {
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

const syncGroupRoles = async (conversation, assignedBy = null) => {
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

const canEditGroupInfo = (conversation, userId) => {
  if (conversation.settings?.onlyAdminsCanEditGroupInfo === false) {
    return hasParticipant(conversation, userId);
  }

  return isGroupAdmin(conversation, userId);
};

const canAddGroupMembers = (conversation, userId) => {
  if (conversation.settings?.onlyAdminsCanAddMembers === false) {
    return hasParticipant(conversation, userId);
  }

  return isGroupAdmin(conversation, userId);
};

const emitConversationToParticipants = (conversation, eventName) => {
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

const normalizeGroupName = (groupName) =>
  typeof groupName === "string" ? groupName.trim() : "";

const normalizeParticipantIds = (participantIds) => {
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

const findGroupForAdmin = async (conversationId, userId) => {
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

const findGroupForOwner = async (conversationId, userId) => {
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

const findUserGroup = async (conversationId, userId) => {
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

const findOrCreateConversation = async ({
  conversationKey,
  legacyQuery,
  participants,
  isSelf,
}) => {
  let conversation =
    (await Conversation.findOne({ conversationKey })) ||
    (await Conversation.findOne(legacyQuery));

  if (conversation) {
    if (!conversation.conversationKey) {
      conversation.conversationKey = conversationKey;
      await conversation.save();
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

export const getConversations = asyncHandler(async (req, res) => {
  const conversations = await populateConversation(
    Conversation.find({
      participants: req.user._id,
      deletedAt: null,
      $or: [
        { isSelf: true },
        { isGroup: true },
        { isSelf: false, isGroup: false, participants: { $size: 2 } },
      ],
    }).sort({ updatedAt: -1 })
  );

  res.status(200).json({
    conversations,
  });
});

export const createConversation = asyncHandler(async (req, res) => {
  const { receiverId, isSelf } = req.body || {};
  const currentUserId = req.user._id;
  const wantsSelfConversation = isSelf === true;

  if (isSelf !== undefined && typeof isSelf !== "boolean") {
    return res.status(400).json({
      message: "isSelf must be a boolean",
    });
  }

  if (wantsSelfConversation) {
    const conversationKey = buildSelfConversationKey(currentUserId);
    const conversation = await findOrCreateConversation({
      conversationKey,
      legacyQuery: {
        isSelf: true,
        participants: currentUserId,
      },
      participants: [currentUserId],
      isSelf: true,
    });

    return res.status(200).json({
      conversation,
    });
  }

  if (!receiverId) {
    return res.status(400).json({
      message: "Receiver ID is required",
    });
  }

  if (!isValidObjectId(receiverId)) {
    return res.status(400).json({
      message: "Invalid receiver ID",
    });
  }

  if (receiverId === currentUserId.toString()) {
    return res.status(400).json({
      message: "Use Saved Messages for self chat",
    });
  }

  const receiver = await User.findById(receiverId);

  if (!receiver) {
    return res.status(404).json({
      message: "Receiver not found",
    });
  }

  if (await hasUserBlock(currentUserId, receiver._id)) {
    return res.status(403).json({
      message: "Conversation blocked by user privacy settings",
    });
  }

  const conversationKey = buildDirectConversationKey([currentUserId, receiverId]);
  const conversation = await findOrCreateConversation({
    conversationKey,
    legacyQuery: {
      isGroup: false,
      isSelf: false,
      participants: { $all: [currentUserId, receiverId], $size: 2 },
    },
    participants: [currentUserId, receiverId],
    isSelf: false,
  });

  res.status(200).json({
    conversation,
  });
});

export const createGroupConversation = asyncHandler(async (req, res) => {
  const groupName = normalizeGroupName(req.body?.groupName);
  const participantIds = normalizeParticipantIds(req.body?.participantIds);
  const currentUserId = req.user._id.toString();

  if (groupName.length < 2 || groupName.length > MAX_GROUP_NAME_LENGTH) {
    return res.status(400).json({
      message: `Group name must be between 2 and ${MAX_GROUP_NAME_LENGTH} characters`,
    });
  }

  if (participantIds.some((participantId) => !isValidObjectId(participantId))) {
    return res.status(400).json({
      message: "Invalid participant ID",
    });
  }

  const participants = Array.from(new Set([currentUserId, ...participantIds]));

  if (participants.length < 2) {
    return res.status(400).json({
      message: "Group needs at least 2 participants",
    });
  }

  const usersCount = await User.countDocuments({
    _id: { $in: participants },
  });

  if (usersCount !== participants.length) {
    return res.status(404).json({
      message: "One or more participants were not found",
    });
  }

  const conversation = await Conversation.create({
    participants,
    isGroup: true,
    isSelf: false,
    groupName,
    admin: req.user._id,
    admins: [req.user._id],
    memberRoles: participants.map((participantId) => ({
      user: participantId,
      role: participantId === currentUserId ? "owner" : "member",
      assignedBy: req.user._id,
      assignedAt: new Date(),
    })),
  });

  const populatedConversation = await populateConversation(
    Conversation.findById(conversation._id)
  );

  emitConversationToParticipants(populatedConversation, "conversation:created");

  res.status(201).json({
    conversation: populatedConversation,
  });
});

export const updateGroupConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const groupName = normalizeGroupName(req.body?.groupName);
  const groupAvatar =
    typeof req.body?.groupAvatar === "string" ? req.body.groupAvatar.trim() : "";

  const conversation = await findUserGroup(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Group not found",
    });
  }

  await syncGroupRoles(conversation, req.user._id);

  if (!canEditGroupInfo(conversation, req.user._id)) {
    return res.status(403).json({
      message: "Group settings allow only admins to edit group info",
    });
  }

  if (conversation.isArchived) {
    return res.status(400).json({
      message: "Archived groups cannot be updated",
    });
  }

  if (groupName) {
    if (groupName.length < 2 || groupName.length > MAX_GROUP_NAME_LENGTH) {
      return res.status(400).json({
        message: `Group name must be between 2 and ${MAX_GROUP_NAME_LENGTH} characters`,
      });
    }

    conversation.groupName = groupName;
  }

  if (groupAvatar) {
    conversation.groupAvatar = groupAvatar;
  }

  await conversation.save();

  const populatedConversation = await populateConversation(
    Conversation.findById(conversation._id)
  );

  emitConversationToParticipants(populatedConversation, "conversation:updated");

  res.status(200).json({
    conversation: populatedConversation,
  });
});

export const addGroupParticipant = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const participantId =
    typeof req.body?.participantId === "string" ? req.body.participantId : "";

  if (!isValidObjectId(participantId)) {
    return res.status(400).json({
      message: "Invalid participant ID",
    });
  }

  const conversation = await findUserGroup(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Group not found",
    });
  }

  await syncGroupRoles(conversation, req.user._id);

  if (!canAddGroupMembers(conversation, req.user._id)) {
    return res.status(403).json({
      message: "Group settings allow only admins to add members",
    });
  }

  if (conversation.isArchived) {
    return res.status(400).json({
      message: "Archived groups cannot add members",
    });
  }

  if (
    conversation.participants.some(
      (participant) => participant.toString() === participantId
    )
  ) {
    return res.status(400).json({
      message: "User is already in the group",
    });
  }

  const user = await User.findById(participantId);

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  conversation.participants.push(user._id);
  conversation.memberRoles.push({
    user: user._id,
    role: "member",
    assignedBy: req.user._id,
    assignedAt: new Date(),
  });
  await conversation.save();
  await syncGroupRoles(conversation, req.user._id);

  const populatedConversation = await populateConversation(
    Conversation.findById(conversation._id)
  );

  emitConversationToParticipants(populatedConversation, "conversation:updated");

  res.status(200).json({
    conversation: populatedConversation,
  });
});

export const removeGroupParticipant = asyncHandler(async (req, res) => {
  const { conversationId, participantId } = req.params;

  if (!isValidObjectId(participantId)) {
    return res.status(400).json({
      message: "Invalid participant ID",
    });
  }

  const conversation = await findGroupForAdmin(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Group not found or admin access required",
    });
  }

  await syncGroupRoles(conversation, req.user._id);

  if (!hasParticipant(conversation, participantId)) {
    return res.status(404).json({
      message: "Participant not found in group",
    });
  }

  if (isGroupOwner(conversation, participantId)) {
    return res.status(400).json({
      message: "Transfer ownership before removing the owner",
    });
  }

  if (isGroupAdmin(conversation, participantId) && !isGroupOwner(conversation, req.user._id)) {
    return res.status(403).json({
      message: "Only the owner can remove another admin",
    });
  }

  if (conversation.participants.length <= 2) {
    return res.status(400).json({
      message: "Group must keep at least 2 participants",
    });
  }

  conversation.participants = conversation.participants.filter(
    (participant) => participant.toString() !== participantId
  );
  conversation.admins = conversation.admins.filter(
    (adminId) => adminId.toString() !== participantId
  );
  conversation.memberRoles = conversation.memberRoles.filter(
    (memberRole) => memberRole.user.toString() !== participantId
  );
  await conversation.save();
  await syncGroupRoles(conversation, req.user._id);

  const populatedConversation = await populateConversation(
    Conversation.findById(conversation._id)
  );

  emitConversationToParticipants(populatedConversation, "conversation:updated");

  res.status(200).json({
    conversation: populatedConversation,
  });
});

export const updateGroupSettings = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const conversation = await findGroupForAdmin(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Group not found or admin access required",
    });
  }

  const allowedSettings = [
    "onlyAdminsCanEditGroupInfo",
    "onlyAdminsCanAddMembers",
    "onlyAdminsCanSendMessages",
  ];

  conversation.settings ||= {};

  allowedSettings.forEach((settingKey) => {
    if (typeof req.body?.[settingKey] === "boolean") {
      conversation.settings[settingKey] = req.body[settingKey];
    }
  });

  await conversation.save();

  const populatedConversation = await populateConversation(
    Conversation.findById(conversation._id)
  );

  emitConversationToParticipants(populatedConversation, "conversation:updated");

  res.status(200).json({
    conversation: populatedConversation,
  });
});

export const promoteGroupAdmin = asyncHandler(async (req, res) => {
  const { conversationId, participantId } = req.params;

  if (!isValidObjectId(participantId)) {
    return res.status(400).json({
      message: "Invalid participant ID",
    });
  }

  const conversation = await findGroupForOwner(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Group not found or owner access required",
    });
  }

  if (!hasParticipant(conversation, participantId)) {
    return res.status(404).json({
      message: "Participant not found in group",
    });
  }

  conversation.admins = uniqueIdStrings([...conversation.admins, participantId]);
  await conversation.save();
  await syncGroupRoles(conversation, req.user._id);

  const populatedConversation = await populateConversation(
    Conversation.findById(conversation._id)
  );

  emitConversationToParticipants(populatedConversation, "conversation:updated");

  res.status(200).json({
    conversation: populatedConversation,
  });
});

export const demoteGroupAdmin = asyncHandler(async (req, res) => {
  const { conversationId, participantId } = req.params;

  if (!isValidObjectId(participantId)) {
    return res.status(400).json({
      message: "Invalid participant ID",
    });
  }

  const conversation = await findGroupForOwner(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Group not found or owner access required",
    });
  }

  if (isGroupOwner(conversation, participantId)) {
    return res.status(400).json({
      message: "Transfer ownership before demoting the owner",
    });
  }

  if (!isGroupAdmin(conversation, participantId)) {
    return res.status(400).json({
      message: "Participant is not an admin",
    });
  }

  conversation.admins = conversation.admins.filter(
    (adminId) => adminId.toString() !== participantId
  );
  await conversation.save();
  await syncGroupRoles(conversation, req.user._id);

  const populatedConversation = await populateConversation(
    Conversation.findById(conversation._id)
  );

  emitConversationToParticipants(populatedConversation, "conversation:updated");

  res.status(200).json({
    conversation: populatedConversation,
  });
});

export const transferGroupOwner = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const newOwnerId =
    typeof req.body?.newOwnerId === "string" ? req.body.newOwnerId.trim() : "";

  if (!isValidObjectId(newOwnerId)) {
    return res.status(400).json({
      message: "Invalid new owner ID",
    });
  }

  const conversation = await findGroupForOwner(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Group not found or owner access required",
    });
  }

  if (!hasParticipant(conversation, newOwnerId)) {
    return res.status(404).json({
      message: "New owner must be a group participant",
    });
  }

  conversation.admin = newOwnerId;
  conversation.admins = uniqueIdStrings([
    req.user._id,
    newOwnerId,
    ...conversation.admins,
  ]);
  await conversation.save();
  await syncGroupRoles(conversation, req.user._id);

  const populatedConversation = await populateConversation(
    Conversation.findById(conversation._id)
  );

  emitConversationToParticipants(populatedConversation, "conversation:updated");

  res.status(200).json({
    conversation: populatedConversation,
  });
});

export const archiveGroupConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const conversation = await findGroupForAdmin(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Group not found or admin access required",
    });
  }

  conversation.isArchived = true;
  conversation.archivedAt = new Date();
  conversation.archivedBy = req.user._id;
  await conversation.save();

  const populatedConversation = await populateConversation(
    Conversation.findById(conversation._id)
  );

  emitConversationToParticipants(populatedConversation, "conversation:updated");

  res.status(200).json({
    conversation: populatedConversation,
  });
});

export const unarchiveGroupConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const conversation = await findGroupForAdmin(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Group not found or admin access required",
    });
  }

  conversation.isArchived = false;
  conversation.archivedAt = null;
  conversation.archivedBy = null;
  await conversation.save();

  const populatedConversation = await populateConversation(
    Conversation.findById(conversation._id)
  );

  emitConversationToParticipants(populatedConversation, "conversation:updated");

  res.status(200).json({
    conversation: populatedConversation,
  });
});

export const deleteGroupConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const conversation = await findGroupForOwner(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Group not found or owner access required",
    });
  }

  conversation.deletedAt = new Date();
  conversation.deletedBy = req.user._id;
  await conversation.save();

  emitConversationToParticipants(conversation, "conversation:deleted");

  res.status(200).json({
    conversationId: conversation._id,
    message: "Group deleted",
  });
});

export const leaveGroupConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const conversation = await findUserGroup(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Group not found",
    });
  }

  const currentUserId = req.user._id.toString();
  const remainingParticipants = conversation.participants.filter(
    (participant) => participant.toString() !== currentUserId
  );

  if (remainingParticipants.length === 0) {
    conversation.deletedAt = new Date();
    conversation.deletedBy = req.user._id;
    await conversation.save();

    return res.status(200).json({
      message: "Group deleted",
    });
  }

  conversation.participants = remainingParticipants;
  conversation.admins = conversation.admins.filter(
    (adminId) => adminId.toString() !== currentUserId
  );
  conversation.memberRoles = conversation.memberRoles.filter(
    (memberRole) => memberRole.user.toString() !== currentUserId
  );

  if (isGroupOwner(conversation, currentUserId)) {
    const nextOwner =
      conversation.admins.find((adminId) =>
        remainingParticipants.some(
          (participant) => participant.toString() === adminId.toString()
        )
      ) || remainingParticipants[0];

    conversation.admin = nextOwner;
    conversation.admins = Array.from(
      new Set([nextOwner.toString(), ...conversation.admins.map(toIdString)])
    );
  }

  await conversation.save();
  await syncGroupRoles(conversation, req.user._id);

  const populatedConversation = await populateConversation(
    Conversation.findById(conversation._id)
  );

  emitConversationToParticipants(populatedConversation, "conversation:updated");

  res.status(200).json({
    conversation: populatedConversation,
  });
});
