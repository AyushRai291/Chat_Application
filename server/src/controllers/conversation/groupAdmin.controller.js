import Conversation from "../../models/Conversation.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  emitConversationToParticipants,
  findGroupForAdmin,
  findGroupForOwner,
  findUserGroup,
  hasParticipant,
  isGroupAdmin,
  isGroupOwner,
  isValidObjectId,
  populateConversation,
  syncGroupRoles,
  toIdString,
  uniqueIdStrings,
} from "./conversation.helpers.js";

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
