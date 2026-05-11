import { ApiError } from "../utils/apiError.js";

export function notFoundHandler(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(error, _req, res, _next) {
  let statusCode = error.statusCode ?? 500;
  let message =
    statusCode === 500 ? "An unexpected server error occurred." : error.message;

  if (error.code === "ER_ACCESS_DENIED_ERROR") {
    statusCode = 503;
    message =
      "Database credentials are invalid. Update the backend .env MySQL settings and restart the server.";
  } else if (
    error.code === "ER_BAD_DB_ERROR" ||
    error.code === "ECONNREFUSED" ||
    error.code === "ENOTFOUND"
  ) {
    statusCode = 503;
    message =
      "The database is unavailable. Verify the MySQL server is running and the backend .env settings are correct.";
  }

  if (statusCode === 500) {
    console.error(error);
  } else if (statusCode === 503) {
    console.error("Database connectivity error:", error);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    message,
    code: error.code ?? String(statusCode),
    details: error.details ?? null
  });
}
