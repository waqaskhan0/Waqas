import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true
  })
);
app.use(helmet());
app.use(express.json());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "ims-backend",
    module: "receiving-engine"
  });
});

app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
