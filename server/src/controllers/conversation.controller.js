import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import "../models/Message.js";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const buildDirectConversationKey = (userIds) =>
  `dm:${userIds.map((id) => id.toString()).sort().join(":")}`;

const buildSelfConversationKey = (userId) => `self:${userId.toString()}`;

const populateConversation = (query) =>
  query.populate("participants", "-password").populate("lastMessage");

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
