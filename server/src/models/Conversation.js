import mongoose from "mongoose";

const groupMemberRoleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      default: "member",
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

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
    admins: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },
    memberRoles: {
      type: [groupMemberRoleSchema],
      default: [],
      validate: {
        validator: (value) =>
          new Set(value.map((memberRole) => memberRole.user.toString()))
            .size === value.length,
        message: "Group member roles must be unique per user",
      },
    },
    settings: {
      onlyAdminsCanEditGroupInfo: {
        type: Boolean,
        default: true,
      },
      onlyAdminsCanAddMembers: {
        type: Boolean,
        default: true,
      },
      onlyAdminsCanSendMessages: {
        type: Boolean,
        default: false,
      },
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    hiddenFor: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
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
conversationSchema.index({ admins: 1 });
conversationSchema.index({ deletedAt: 1 });
conversationSchema.index({ hiddenFor: 1 });
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
