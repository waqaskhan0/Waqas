import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import {
  changeUserRole,
  createUser,
  listManagers,
  listUsers,
  setUserStatus,
  updateUser
} from "./users.service.js";

function parseUserId(value) {
  const userId = Number(value);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ApiError(400, "A valid user id is required.");
  }

  return userId;
}

export const listUsersController = asyncHandler(async (_req, res) => {
  const users = await listUsers();
  res.json({ users });
});

export const listManagersController = asyncHandler(async (_req, res) => {
  const managers = await listManagers();
  res.json({ managers });
});

export const createUserController = asyncHandler(async (req, res) => {
  const user = await createUser(req.body);
  res.status(201).json({ user });
});

export const updateUserController = asyncHandler(async (req, res) => {
  const user = await updateUser(parseUserId(req.params.id), req.body);
  res.json({ user });
});

export const deactivateUserController = asyncHandler(async (req, res) => {
  await setUserStatus(parseUserId(req.params.id), "INACTIVE");
  res.json({ ok: true });
});

export const activateUserController = asyncHandler(async (req, res) => {
  await setUserStatus(parseUserId(req.params.id), "ACTIVE");
  res.json({ ok: true });
});

export const changeUserRoleController = asyncHandler(async (req, res) => {
  await changeUserRole(parseUserId(req.params.id), String(req.body.role ?? req.body.roleCode ?? ""));
  res.json({ ok: true });
});
