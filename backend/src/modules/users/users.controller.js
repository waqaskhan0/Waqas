import { asyncHandler } from "../../utils/asyncHandler.js";
import { listManagers, listUsers } from "./users.service.js";

export const listUsersController = asyncHandler(async (_req, res) => {
  const users = await listUsers();
  res.json({ users });
});

export const listManagersController = asyncHandler(async (_req, res) => {
  const managers = await listManagers();
  res.json({ managers });
});
