import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  createAnnouncementController,
  deleteAnnouncementController,
  listAnnouncementsController
} from "./announcements.controller.js";

export const announcementsRouter = Router();

announcementsRouter.use(authenticate);
announcementsRouter.get("/", listAnnouncementsController);
announcementsRouter.post(
  "/",
  authorizeRoles(ROLES.HR_OFFICER, ROLES.SUPER_ADMIN),
  createAnnouncementController
);
announcementsRouter.delete(
  "/:id",
  authorizeRoles(ROLES.SUPER_ADMIN),
  deleteAnnouncementController
);
