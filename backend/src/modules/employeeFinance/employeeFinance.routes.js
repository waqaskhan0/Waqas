import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  createAdvanceController,
  createReimbursementController,
  decideAdvanceController,
  decideReimbursementController,
  listAllAdvancesController,
  listAllReimbursementsController,
  listMyAdvancesController,
  listMyReimbursementsController
} from "./employeeFinance.controller.js";

export const advanceRouter = Router();
export const reimbursementRouter = Router();

advanceRouter.use(authenticate);
advanceRouter.post("/", createAdvanceController);
advanceRouter.get("/my", listMyAdvancesController);
advanceRouter.get("/all", authorizeRoles(ROLES.FINANCE, ROLES.SUPER_ADMIN), listAllAdvancesController);
advanceRouter.patch(
  "/:id/action",
  authorizeRoles(ROLES.FINANCE, ROLES.SUPER_ADMIN),
  decideAdvanceController
);

reimbursementRouter.use(authenticate);
reimbursementRouter.post("/", createReimbursementController);
reimbursementRouter.get("/my", listMyReimbursementsController);
reimbursementRouter.get(
  "/all",
  authorizeRoles(ROLES.FINANCE, ROLES.SUPER_ADMIN),
  listAllReimbursementsController
);
reimbursementRouter.patch(
  "/:id/action",
  authorizeRoles(ROLES.FINANCE, ROLES.SUPER_ADMIN),
  decideReimbursementController
);
