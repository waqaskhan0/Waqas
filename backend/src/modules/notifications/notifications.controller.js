import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import {
  listMyNotifications,
  markNotificationRead
} from "./notifications.service.js";

export const listMyNotificationsController = asyncHandler(async (req, res) => {
  const notifications = await listMyNotifications(req.user.id);
  res.json({ notifications });
});

export const markNotificationReadController = asyncHandler(async (req, res) => {
  const recipientId = Number(req.params.id);

  if (!Number.isInteger(recipientId) || recipientId <= 0) {
    throw new ApiError(400, "A valid notification id is required.");
  }

  const notification = await markNotificationRead(req.user.id, recipientId);
  res.json({ notification });
});
