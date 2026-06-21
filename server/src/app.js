import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import testRoutes from "./routes/test.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { notFound, errorHandler } from "./middlewares/error.middleware.js";
import userRoutes from "./routes/user.routes.js";
const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("API running");
});

app.use("/api/test", testRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;