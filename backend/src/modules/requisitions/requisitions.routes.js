import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  approveRequisitionController,
  createRequisitionController,
  getRequisitionController,
  listManagerRequisitionsController,
  listMyRequisitionsController,
  rejectRequisitionController
} from "./requisitions.controller.js";

export const requisitionsRouter = Router();

requisitionsRouter.use(authenticate);
requisitionsRouter.get(
  "/manager",
  authorizeRoles(ROLES.LINE_MANAGER),
  listManagerRequisitionsController
);
requisitionsRouter.get("/my", authorizeRoles(ROLES.EMPLOYEE), listMyRequisitionsController);
requisitionsRouter.post(
  "/:id/approve",
  authorizeRoles(ROLES.LINE_MANAGER),
  approveRequisitionController
);
requisitionsRouter.post(
  "/:id/reject",
  authorizeRoles(ROLES.LINE_MANAGER),
  rejectRequisitionController
);
requisitionsRouter.get("/:id", getRequisitionController);
requisitionsRouter.post("/", authorizeRoles(ROLES.EMPLOYEE), createRequisitionController);
