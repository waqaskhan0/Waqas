import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  approveRequisition,
  createRequisition,
  getRequisitionByIdForUser,
  listManagerRequisitions,
  listMyRequisitions,
  rejectRequisition
} from "./requisitions.service.js";
import {
  parseApprovalDecisionPayload,
  parseCreateRequisitionPayload
} from "./requisitions.validation.js";

function parseRequisitionId(value) {
  const requisitionId = Number(value);

  if (!Number.isInteger(requisitionId) || requisitionId <= 0) {
    return null;
  }

  return requisitionId;
}

export const createRequisitionController = asyncHandler(async (req, res) => {
  const payload = parseCreateRequisitionPayload(req.body);
  const result = await createRequisition(req.user, payload);

  res.status(201).json(result);
});

export const listMyRequisitionsController = asyncHandler(async (req, res) => {
  const requisitions = await listMyRequisitions(req.user.id);
  res.json({ requisitions });
});

export const listManagerRequisitionsController = asyncHandler(async (req, res) => {
  const requisitions = await listManagerRequisitions(req.user.id);
  res.json({ requisitions });
});

export const getRequisitionController = asyncHandler(async (req, res) => {
  const requisitionId = parseRequisitionId(req.params.id);

  if (!requisitionId) {
    res.status(400).json({
      error: "A valid requisition id is required.",
      details: null
    });
    return;
  }

  const requisition = await getRequisitionByIdForUser(requisitionId, req.user);

  res.json({ requisition });
});

export const approveRequisitionController = asyncHandler(async (req, res) => {
  const requisitionId = parseRequisitionId(req.params.id);

  if (!requisitionId) {
    res.status(400).json({
      error: "A valid requisition id is required.",
      details: null
    });
    return;
  }

  const { remarks } = parseApprovalDecisionPayload(req.body, "Approval");
  const result = await approveRequisition(req.user, requisitionId, remarks);

  res.json(result);
});

export const rejectRequisitionController = asyncHandler(async (req, res) => {
  const requisitionId = parseRequisitionId(req.params.id);

  if (!requisitionId) {
    res.status(400).json({
      error: "A valid requisition id is required.",
      details: null
    });
    return;
  }

  const { remarks } = parseApprovalDecisionPayload(req.body, "Rejection");
  const result = await rejectRequisition(req.user, requisitionId, remarks);

  res.json(result);
});
