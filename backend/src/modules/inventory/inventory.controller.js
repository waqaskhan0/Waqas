import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  listInventoryQueue,
  listInventoryStock,
  processInventoryDecision
} from "./inventory.service.js";
import { parseInventoryProcessingPayload } from "./inventory.validation.js";

function parseRequisitionId(value) {
  const requisitionId = Number(value);

  if (!Number.isInteger(requisitionId) || requisitionId <= 0) {
    return null;
  }

  return requisitionId;
}

export const listInventoryQueueController = asyncHandler(async (_req, res) => {
  const requisitions = await listInventoryQueue();
  res.json({ requisitions });
});

export const listInventoryStockController = asyncHandler(async (_req, res) => {
  const stockItems = await listInventoryStock();
  res.json({ stockItems });
});

export const processInventoryDecisionController = asyncHandler(async (req, res) => {
  const requisitionId = parseRequisitionId(req.params.id);

  if (!requisitionId) {
    res.status(400).json({
      error: "A valid requisition id is required.",
      details: null
    });
    return;
  }

  const payload = parseInventoryProcessingPayload(req.body);
  const result = await processInventoryDecision(req.user, requisitionId, payload);

  res.json(result);
});
