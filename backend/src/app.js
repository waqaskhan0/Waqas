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
    origin(origin, callback) {
      if (!origin || env.clientUrls.includes(origin)) {
        callback(null, true);
        return;
      }

      if (env.nodeEnv !== "production") {
        try {
          const url = new URL(origin);
          if (["localhost", "127.0.0.1"].includes(url.hostname)) {
            callback(null, true);
            return;
          }
        } catch (_error) {
          // Fall through to the standard CORS rejection below.
        }
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
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
