import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  listAttendanceForUsers,
  listMyAttendance,
  signOutToday
} from "./attendance.service.js";

export const listMyAttendanceController = asyncHandler(async (req, res) => {
  const attendance = await listMyAttendance(req.user.id);
  res.json({ attendance });
});

export const signOutTodayController = asyncHandler(async (req, res) => {
  const attendance = await signOutToday(req.user.id);
  res.json({ attendance });
});

export const listAllAttendanceController = asyncHandler(async (req, res) => {
  const attendance = await listAttendanceForUsers({
    date: req.query.date,
    department: req.query.department,
    userId: req.query.userId ? Number(req.query.userId) : null
  });

  res.json({ attendance });
});
