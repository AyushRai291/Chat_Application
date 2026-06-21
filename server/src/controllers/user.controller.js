import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const searchUsers = asyncHandler(async (req, res) => {
  const search = req.query.search || "";

  const query = {
    _id: { $ne: req.user._id },
  };

  if (search.trim()) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(query).select("-password");

  res.status(200).json({
    users,
  });
});