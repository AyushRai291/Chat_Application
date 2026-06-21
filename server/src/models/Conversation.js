import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    conversationKey: {
      type: String,
      trim: true,
      default: undefined,
    },
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      validate: [
        {
          validator: (value) => Array.isArray(value) && value.length > 0,
          message: "Conversation needs at least one participant",
        },
        {
          validator: (value) =>
            Array.isArray(value) &&
            value.every(Boolean) &&
            new Set(value.map((participant) => participant.toString())).size ===
              value.length,
          message: "Conversation participants must be unique",
        },
      ],
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    isSelf: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      trim: true,
      default: "",
    },
    groupAvatar: {
      type: String,
      default: "",
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ conversationKey: 1 }, { unique: true, sparse: true });
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
