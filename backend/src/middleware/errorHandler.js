import { ApiError } from "../utils/apiError.js";

export function notFoundHandler(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode ?? 500;
  const message =
    statusCode === 500 ? "An unexpected server error occurred." : error.message;

  if (statusCode === 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    error: message,
    details: error.details ?? null
  });
}
