import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import { listManagersController, listUsersController } from "./users.controller.js";

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.get("/managers", listManagersController);
usersRouter.get(
  "/",
  authorizeRoles(
    ROLES.LINE_MANAGER,
    ROLES.INVENTORY_OFFICER,
    ROLES.PROCUREMENT_OFFICER,
    ROLES.FINANCE
  ),
  listUsersController
);
