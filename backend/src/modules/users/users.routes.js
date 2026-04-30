import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  activateUserController,
  changeUserRoleController,
  createUserController,
  deactivateUserController,
  listManagersController,
  listUsersController,
  updateUserController
} from "./users.controller.js";

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.get("/managers", listManagersController);
usersRouter.get(
  "/",
  authorizeRoles(
    ROLES.LINE_MANAGER,
    ROLES.INVENTORY_OFFICER,
    ROLES.PROCUREMENT_OFFICER,
    ROLES.FINANCE,
    ROLES.HR_OFFICER,
    ROLES.SUPER_ADMIN
  ),
  listUsersController
);
usersRouter.post("/", authorizeRoles(ROLES.SUPER_ADMIN), createUserController);
usersRouter.put("/:id", authorizeRoles(ROLES.SUPER_ADMIN), updateUserController);
usersRouter.patch("/:id/deactivate", authorizeRoles(ROLES.SUPER_ADMIN), deactivateUserController);
usersRouter.patch("/:id/activate", authorizeRoles(ROLES.SUPER_ADMIN), activateUserController);
usersRouter.patch("/:id/role", authorizeRoles(ROLES.SUPER_ADMIN), changeUserRoleController);
