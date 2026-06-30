import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = ["MONGO_URI", "JWT_SECRET"];
const DEFAULT_DEV_CLIENT_URL = "http://localhost:5173";

export const validateEnv = () => {
  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required env vars: ${missingEnvVars.join(", ")}`);
  }
};

export const getClientUrls = () => {
  const configuredUrls = (process.env.CLIENT_URL || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === "production") {
    return Array.from(new Set(configuredUrls));
  }

  return Array.from(new Set([DEFAULT_DEV_CLIENT_URL, ...configuredUrls]));
};

export const getCorsOrigin = (origin, callback) => {
  const allowedOrigins = getClientUrls();

  if (!origin) {
    return callback(null, true);
  }

  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error("Not allowed by CORS"));
};

export const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge,
});
