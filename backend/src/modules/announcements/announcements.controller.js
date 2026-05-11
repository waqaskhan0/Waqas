import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements
} from "./announcements.service.js";

function parseId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "A valid announcement id is required.");
  }

  return id;
}

export const listAnnouncementsController = asyncHandler(async (_req, res) => {
  const announcements = await listAnnouncements();
  res.json({ announcements });
});

export const createAnnouncementController = asyncHandler(async (req, res) => {
  const announcement = await createAnnouncement(req.user, req.body);
  res.status(201).json({ announcement });
});

export const deleteAnnouncementController = asyncHandler(async (req, res) => {
  await deleteAnnouncement(parseId(req.params.id));
  res.status(204).send();
});
