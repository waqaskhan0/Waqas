import { asyncHandler } from "../../utils/asyncHandler.js";
import { getSettings, listAuditLogs, updateSettings } from "./admin.service.js";

export const listAuditLogsController = asyncHandler(async (req, res) => {
  const result = await listAuditLogs(req.query);
  res.json(result);
});

export const getSettingsController = asyncHandler(async (_req, res) => {
  const settings = await getSettings();
  res.json({ settings });
});

export const updateSettingsController = asyncHandler(async (req, res) => {
  const settings = await updateSettings(req.user.id, req.body);
  res.json({ settings });
});
