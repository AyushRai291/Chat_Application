import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { uploadsDir } from "./middlewares/upload.middleware.js";
import testRoutes from "./routes/test.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { notFound, errorHandler } from "./middlewares/error.middleware.js";
import userRoutes from "./routes/user.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import messageRoutes from "./routes/message.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(uploadsDir));

app.get("/", (req, res) => {
  res.send("API running");
});

app.use("/api/test", testRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;