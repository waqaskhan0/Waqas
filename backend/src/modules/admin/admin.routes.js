import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  getSettingsController,
  listAuditLogsController,
  updateSettingsController
} from "./admin.controller.js";

export const auditRouter = Router();
export const settingsRouter = Router();

auditRouter.use(authenticate, authorizeRoles(ROLES.SUPER_ADMIN));
auditRouter.get("/", listAuditLogsController);

settingsRouter.use(authenticate);
settingsRouter.get("/", getSettingsController);
settingsRouter.put("/", authorizeRoles(ROLES.SUPER_ADMIN), updateSettingsController);
