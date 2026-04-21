import { ApiError } from "../../utils/apiError.js";

export function parseLoginPayload(payload) {
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");

  if (!email || !email.includes("@")) {
    throw new ApiError(400, "A valid email address is required.");
  }

  if (!password || password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters long.");
  }

  return { email, password };
}
