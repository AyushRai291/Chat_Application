import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import "../models/Message.js";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getIO } from "../socket/socket.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const MAX_GROUP_NAME_LENGTH = 80;

const buildDirectConversationKey = (userIds) =>
  `dm:${userIds.map((id) => id.toString()).sort().join(":")}`;

const buildSelfConversationKey = (userId) => `self:${userId.toString()}`;

const populateConversation = (query) =>
  query.populate("participants", "-password").populate("lastMessage");

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
  if (!isValidObjectId(conversationId)) {
    return null;
  }

  return Conversation.findOne({
    _id: conversationId,
    isGroup: true,
    admin: userId,
    participants: userId,
  });
};

const findUserGroup = async (conversationId, userId) => {
  if (!isValidObjectId(conversationId)) {
    return null;
  }

  return Conversation.findOne({
    _id: conversationId,
    isGroup: true,
    participants: userId,
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
  const conversations = await Conversation.find({
    participants: req.user._id,
    $or: [
      { isSelf: true },
      { isGroup: true },
      { isSelf: false, isGroup: false, participants: { $size: 2 } },
    ],
  })
    .populate("participants", "-password")
    .populate("lastMessage")
    .sort({ updatedAt: -1 });

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

  const conversation = await findGroupForAdmin(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Group not found or admin access required",
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

  const conversation = await findGroupForAdmin(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Group not found or admin access required",
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
  await conversation.save();

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

  if (conversation.admin?.toString() === participantId) {
    return res.status(400).json({
      message: "Admin cannot be removed from the group",
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
  await conversation.save();

  const populatedConversation = await populateConversation(
    Conversation.findById(conversation._id)
  );

  emitConversationToParticipants(populatedConversation, "conversation:updated");

  res.status(200).json({
    conversation: populatedConversation,
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
    await Conversation.findByIdAndDelete(conversation._id);

    return res.status(200).json({
      message: "Group deleted",
    });
  }

  conversation.participants = remainingParticipants;

  if (conversation.admin?.toString() === currentUserId) {
    conversation.admin = remainingParticipants[0];
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
