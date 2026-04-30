import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import {
  getDashboardStatsController,
  getWorkspaceStateController
} from "./dashboard.controller.js";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.get("/", getDashboardStatsController);
dashboardRouter.get("/state", getWorkspaceStateController);
