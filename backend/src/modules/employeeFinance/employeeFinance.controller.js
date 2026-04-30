import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import {
  createAdvanceRequest,
  createReimbursementClaim,
  decideAdvance,
  decideReimbursement,
  listAllAdvances,
  listAllReimbursements,
  listMyAdvances,
  listMyReimbursements
} from "./employeeFinance.service.js";

function parseId(value, label) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, `A valid ${label} is required.`);
  }

  return id;
}

export const createAdvanceController = asyncHandler(async (req, res) => {
  const advance = await createAdvanceRequest(req.user, req.body);
  res.status(201).json({ advance });
});

export const listMyAdvancesController = asyncHandler(async (req, res) => {
  const advances = await listMyAdvances(req.user.id);
  res.json({ advances });
});

export const listAllAdvancesController = asyncHandler(async (_req, res) => {
  const advances = await listAllAdvances();
  res.json({ advances });
});

export const decideAdvanceController = asyncHandler(async (req, res) => {
  const advance = await decideAdvance(req.user, parseId(req.params.id, "advance id"), req.body);
  res.json({ advance });
});

export const createReimbursementController = asyncHandler(async (req, res) => {
  const reimbursement = await createReimbursementClaim(req.user, req.body);
  res.status(201).json({ reimbursement });
});

export const listMyReimbursementsController = asyncHandler(async (req, res) => {
  const reimbursements = await listMyReimbursements(req.user.id);
  res.json({ reimbursements });
});

export const listAllReimbursementsController = asyncHandler(async (_req, res) => {
  const reimbursements = await listAllReimbursements();
  res.json({ reimbursements });
});

export const decideReimbursementController = asyncHandler(async (req, res) => {
  const reimbursement = await decideReimbursement(
    req.user,
    parseId(req.params.id, "claim id"),
    req.body
  );
  res.json({ reimbursement });
});
