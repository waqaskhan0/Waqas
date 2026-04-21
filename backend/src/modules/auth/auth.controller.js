import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseLoginPayload } from "./auth.validation.js";
import { getCurrentUser, login, logout } from "./auth.service.js";

export const loginController = asyncHandler(async (req, res) => {
  const credentials = parseLoginPayload(req.body);

  const result = await login({
    ...credentials,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] ?? "unknown"
  });

  res.status(200).json(result);
});

export const meController = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.user.id);
  res.json({ user });
});

export const logoutController = asyncHandler(async (req, res) => {
  await logout(req.session.id);
  res.status(204).send();
});
