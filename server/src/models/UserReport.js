import mongoose from "mongoose";

const userReportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    reason: {
      type: String,
      enum: ["spam", "harassment", "impersonation", "illegal", "other"],
      default: "other",
    },
    details: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    status: {
      type: String,
      enum: ["open", "reviewing", "resolved", "dismissed"],
      default: "open",
    },
  },
  {
    timestamps: true,
  }
);

userReportSchema.index({ reportedUser: 1, status: 1, createdAt: -1 });
userReportSchema.index({ reporter: 1, createdAt: -1 });

const UserReport = mongoose.model("UserReport", userReportSchema);

export default UserReport;
