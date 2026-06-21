import bcrypt from "bcryptjs";
import { z } from "zod";
import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// ------------
// SIGNUP SETUP
// ------------

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signup = asyncHandler(async (req, res) => {
    const result = signupSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: result.error.issues[0].message,
      });
    }

    const { name, email, password } = result.data;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    generateToken(user._id, res);

    res.status(201).json({
      message: "Signup successful",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
});





// ------------
// Login SETUP
// ------------


const loginSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const login = asyncHandler(async (req, res) => {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: result.error.issues[0].message,
      });
    }

    const { email, password } = result.data;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    generateToken(user._id, res);

    res.status(200).json({
      message: "Login successful",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
});




// ------------
// LogOut SETUP
// ------------

export const logout = asyncHandler(async (req, res) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });

  res.status(200).json({
    message: "Logout successful",
  });
});


// ------------
// GetMe Setup 
// baar baar password check nhi krna pdega 
// login ke baad jwt token verify se kaam hojayega
// ------------

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    user: req.user,
  });
});