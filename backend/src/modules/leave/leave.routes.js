import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  createLeaveController,
  getLeaveBalanceController,
  hrLeaveDecisionController,
  listAllLeavesController,
  listMyLeavesController,
  listTeamLeavesController,
  managerLeaveDecisionController
} from "./leave.controller.js";

export const leaveRouter = Router();

leaveRouter.use(authenticate);
leaveRouter.post("/", createLeaveController);
leaveRouter.get("/my", listMyLeavesController);
leaveRouter.get("/balance/:userId?", getLeaveBalanceController);
leaveRouter.get("/team", authorizeRoles(ROLES.LINE_MANAGER), listTeamLeavesController);
leaveRouter.get(
  "/all",
  authorizeRoles(ROLES.HR_OFFICER, ROLES.SUPER_ADMIN),
  listAllLeavesController
);
leaveRouter.patch(
  "/:id/manager",
  authorizeRoles(ROLES.LINE_MANAGER),
  managerLeaveDecisionController
);
leaveRouter.patch(
  "/:id/hr",
  authorizeRoles(ROLES.HR_OFFICER, ROLES.SUPER_ADMIN),
  hrLeaveDecisionController
);
