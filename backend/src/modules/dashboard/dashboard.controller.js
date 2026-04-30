import { asyncHandler } from "../../utils/asyncHandler.js";
import { getDashboardStats, getWorkspaceState } from "./dashboard.service.js";

export const getDashboardStatsController = asyncHandler(async (req, res) => {
  const stats = await getDashboardStats(req.user);
  res.json({ stats });
});

export const getWorkspaceStateController = asyncHandler(async (req, res) => {
  const state = await getWorkspaceState(req.user);
  res.json({ state });
});
