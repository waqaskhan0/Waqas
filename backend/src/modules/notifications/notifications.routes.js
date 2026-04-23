import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import {
  listMyNotificationsController,
  markNotificationReadController
} from "./notifications.controller.js";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);
notificationsRouter.get("/my", listMyNotificationsController);
notificationsRouter.post("/:id/read", markNotificationReadController);
