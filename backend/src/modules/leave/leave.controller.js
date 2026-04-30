import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import {
  createLeaveRequest,
  decideLeaveAsHr,
  decideLeaveAsManager,
  getLeaveBalances,
  listAllLeaves,
  listMyLeaves,
  listTeamLeaves
} from "./leave.service.js";
import {
  parseLeaveDecisionPayload,
  parseLeaveRequestPayload
} from "./leave.validation.js";

function parseId(value, label = "id") {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, `A valid ${label} is required.`);
  }

  return id;
}

export const createLeaveController = asyncHandler(async (req, res) => {
  const payload = parseLeaveRequestPayload(req.body);
  const leave = await createLeaveRequest(req.user, payload);
  res.status(201).json({ leave });
});

export const listMyLeavesController = asyncHandler(async (req, res) => {
  const leaves = await listMyLeaves(req.user.id);
  res.json({ leaves });
});

export const getLeaveBalanceController = asyncHandler(async (req, res) => {
  const userId = req.params.userId ? parseId(req.params.userId, "user id") : req.user.id;
  const balances = await getLeaveBalances(userId);
  res.json({ balances });
});

export const listTeamLeavesController = asyncHandler(async (req, res) => {
  const leaves = await listTeamLeaves(req.user.id);
  res.json({ leaves });
});

export const listAllLeavesController = asyncHandler(async (req, res) => {
  const leaves = await listAllLeaves({
    status: req.query.status,
    search: req.query.search
  });
  res.json({ leaves });
});

export const managerLeaveDecisionController = asyncHandler(async (req, res) => {
  const leaveId = parseId(req.params.id, "leave id");
  const payload = parseLeaveDecisionPayload(req.body);
  const leave = await decideLeaveAsManager(req.user, leaveId, payload);
  res.json({ leave });
});

export const hrLeaveDecisionController = asyncHandler(async (req, res) => {
  const leaveId = parseId(req.params.id, "leave id");
  const payload = parseLeaveDecisionPayload(req.body);
  const leave = await decideLeaveAsHr(req.user, leaveId, payload);
  res.json({ leave });
});
