import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const searchUsers = asyncHandler(async (req, res) => {
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";

  const query = {
    _id: { $ne: req.user._id },
  };

  if (search) {
    const escapedSearch = escapeRegex(search);

    query.$or = [
      { name: { $regex: escapedSearch, $options: "i" } },
      { email: { $regex: escapedSearch, $options: "i" } },
    ];
  }

  const users = await User.find(query)
    .select("-password")
    .sort({ name: 1 })
    .limit(20);

  res.status(200).json({
    users,
  });
});
