import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { hasBlockedDirectParticipant } from "../../utils/blocking.js";
import {
  escapeRegex,
  findUserConversation,
  isValidObjectId,
  normalizeLimit,
  normalizeSearchLimit,
  populateMessage,
  populateSearchMessage,
} from "./message.helpers.js";

export const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  if (!isValidObjectId(conversationId)) {
    return res.status(400).json({
      message: "Invalid conversation ID",
    });
  }

  const conversation = await findUserConversation(conversationId, req.user._id);

  if (!conversation) {
    return res.status(404).json({
      message: "Conversation not found",
    });
  }

  if (await hasBlockedDirectParticipant({ conversation, userId: req.user._id })) {
    return res.status(403).json({
      message: "Conversation blocked by user privacy settings",
    });
  }

  const limit = normalizeLimit(req.query.limit);
  const messageQuery = {
    conversation: conversation._id,
    deletedFor: { $ne: req.user._id },
  };

  if (req.query.before) {
    const beforeDate = new Date(req.query.before);

    if (Number.isNaN(beforeDate.getTime())) {
      return res.status(400).json({
        message: "Invalid before cursor",
      });
    }

    messageQuery.createdAt = { $lt: beforeDate };
  }

  const messages = await populateMessage(
    Message.find(messageQuery).sort({ createdAt: -1 }).limit(limit)
  );

  messages.reverse();

  res.status(200).json({
    messages,
    pagination: {
      limit,
      hasMore: messages.length === limit,
    },
  });
});

export const searchMessages = asyncHandler(async (req, res) => {
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";
  const conversationId =
    typeof req.query.conversationId === "string"
      ? req.query.conversationId.trim()
      : "";

  if (search.length < 2) {
    return res.status(400).json({
      message: "Search query must be at least 2 characters",
    });
  }

  const limit = normalizeSearchLimit(req.query.limit);
  const conversationQuery = {
    participants: req.user._id,
  };

  if (conversationId) {
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({
        message: "Invalid conversation ID",
      });
    }

    conversationQuery._id = conversationId;
  }

  const conversations = await Conversation.find({
    ...conversationQuery,
    deletedAt: null,
  }).select("_id participants isGroup isSelf");
  const accessibleConversations = [];

  for (const conversation of conversations) {
    if (!(await hasBlockedDirectParticipant({ conversation, userId: req.user._id }))) {
      accessibleConversations.push(conversation);
    }
  }

  const conversationIds = accessibleConversations.map(
    (conversation) => conversation._id
  );

  if (conversationIds.length === 0) {
    return res.status(200).json({
      messages: [],
      pagination: {
        limit,
        hasMore: false,
      },
    });
  }

  const escapedSearch = escapeRegex(search);
  const messageQuery = {
    conversation: { $in: conversationIds },
    deletedFor: { $ne: req.user._id },
    deletedForEveryone: false,
    $or: [
      { text: { $regex: escapedSearch, $options: "i" } },
      { "attachments.fileName": { $regex: escapedSearch, $options: "i" } },
    ],
  };

  if (req.query.before) {
    const beforeDate = new Date(req.query.before);

    if (Number.isNaN(beforeDate.getTime())) {
      return res.status(400).json({
        message: "Invalid before cursor",
      });
    }

    messageQuery.createdAt = { $lt: beforeDate };
  }

  const searchResults = await populateSearchMessage(
    Message.find(messageQuery)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
  );

  const hasMore = searchResults.length > limit;
  const messages = searchResults.slice(0, limit);

  res.status(200).json({
    messages,
    pagination: {
      limit,
      hasMore,
    },
  });
});
