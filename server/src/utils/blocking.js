import UserBlock from "../models/UserBlock.js";

const toIdString = (value) => value?._id?.toString() || value?.toString();

export const getBlockedRelationshipUserIds = async (userId) => {
  const currentUserId = userId.toString();
  const blocks = await UserBlock.find({
    $or: [
      { blocker: currentUserId },
      { blocked: currentUserId },
    ],
  }).select("blocker blocked");

  return Array.from(
    new Set(
      blocks.map((block) =>
        block.blocker.toString() === currentUserId
          ? block.blocked.toString()
          : block.blocker.toString()
      )
    )
  );
};

export const hasUserBlock = async (firstUserId, secondUserId) => {
  const firstId = firstUserId.toString();
  const secondId = secondUserId.toString();

  return Boolean(
    await UserBlock.exists({
      $or: [
        { blocker: firstId, blocked: secondId },
        { blocker: secondId, blocked: firstId },
      ],
    })
  );
};

export const hasBlockedDirectParticipant = async ({
  conversation,
  userId,
}) => {
  if (!conversation || conversation.isGroup || conversation.isSelf) {
    return false;
  }

  const currentUserId = userId.toString();
  const otherParticipant = conversation.participants
    .map(toIdString)
    .find((participantId) => participantId !== currentUserId);

  if (!otherParticipant) {
    return false;
  }

  return hasUserBlock(currentUserId, otherParticipant);
};
