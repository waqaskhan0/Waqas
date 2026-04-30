import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  listAllAttendanceController,
  listMyAttendanceController,
  signOutTodayController
} from "./attendance.controller.js";

export const attendanceRouter = Router();

attendanceRouter.use(authenticate);
attendanceRouter.get("/my", listMyAttendanceController);
attendanceRouter.patch("/signout", signOutTodayController);
attendanceRouter.get(
  "/all",
  authorizeRoles(ROLES.HR_OFFICER, ROLES.SUPER_ADMIN, ROLES.LINE_MANAGER),
  listAllAttendanceController
);
