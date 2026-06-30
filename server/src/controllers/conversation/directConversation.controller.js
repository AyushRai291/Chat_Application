import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { hasUserBlock } from "../../utils/blocking.js";
import {
  buildDirectConversationKey,
  buildSelfConversationKey,
  emitConversationToUser,
  findOrCreateConversation,
  isValidObjectId,
  populateConversation,
  populateConversationList,
  toIdString,
} from "./conversation.helpers.js";

export const getConversations = asyncHandler(async (req, res) => {
  const conversations = await populateConversationList(
    Conversation.find({
      participants: req.user._id,
      deletedAt: null,
      hiddenFor: { $ne: req.user._id },
      $or: [
        { isSelf: true },
        { isGroup: true },
        { isSelf: false, isGroup: false, participants: { $size: 2 } },
      ],
    }).sort({ updatedAt: -1 }),
    req.user._id
  );
  const currentUserId = req.user._id.toString();
  const conversationIds = conversations.map((conversation) => conversation._id);
  const unreadCounts = await Message.aggregate([
    {
      $match: {
        conversation: { $in: conversationIds },
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id },
        deletedFor: { $ne: req.user._id },
        deletedForEveryone: false,
      },
    },
    {
      $group: {
        _id: "$conversation",
        count: { $sum: 1 },
      },
    },
  ]);
  const unreadCountByConversationId = new Map(
    unreadCounts.map((item) => [item._id.toString(), item.count])
  );
  const normalizedConversations = conversations.map((conversation) => {
    const item = conversation.toObject();
    const lastMessageDeletedForUser = item.lastMessage?.deletedFor?.some(
      (userId) => toIdString(userId) === currentUserId
    );
    const unreadCount =
      unreadCountByConversationId.get(conversation._id.toString()) || 0;

    return lastMessageDeletedForUser
      ? {
          ...item,
          lastMessage: null,
          unreadCount,
        }
      : {
          ...item,
          unreadCount,
        };
  });

  res.status(200).json({
    conversations: normalizedConversations,
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
      revealFor: currentUserId,
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
    revealFor: currentUserId,
  });

  res.status(200).json({
    conversation,
  });
});

export const deleteConversationForMe = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  if (!isValidObjectId(conversationId)) {
    return res.status(400).json({
      message: "Invalid conversation ID",
    });
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: req.user._id,
    deletedAt: null,
  }).select("_id participants");

  if (!conversation) {
    return res.status(404).json({
      message: "Conversation not found",
    });
  }

  await Promise.all([
    Message.updateMany(
      {
        conversation: conversation._id,
        deletedFor: { $ne: req.user._id },
      },
      {
        $addToSet: {
          deletedFor: req.user._id,
        },
      }
    ),
    Conversation.findByIdAndUpdate(conversation._id, {
      $addToSet: {
        hiddenFor: req.user._id,
      },
    }),
  ]);

  const payload = {
    conversationId: conversation._id.toString(),
  };

  emitConversationToUser(req.user._id, "conversation:deleted-for-me", payload);

  res.status(200).json(payload);
});
