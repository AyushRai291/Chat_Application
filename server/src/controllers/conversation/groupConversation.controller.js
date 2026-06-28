import Conversation from "../../models/Conversation.js";
import User from "../../models/User.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  MAX_GROUP_NAME_LENGTH,
  canAddGroupMembers,
  canEditGroupInfo,
  emitConversationToParticipants,
  findGroupForAdmin,
  findUserGroup,
  hasParticipant,
  isGroupOwner,
  isValidObjectId,
  normalizeGroupName,
  normalizeParticipantIds,
  syncGroupRoles,
} from "./conversation.helpers.js";

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
