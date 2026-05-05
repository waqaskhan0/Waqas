import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createStockItem,
  getInventoryDashboard,
  listInventoryQueue,
  listInventoryRequests,
  listInventoryStock,
  processInventoryDecision
} from "./inventory.service.js";
import {
  parseCreateStockItemPayload,
  parseInventoryProcessingPayload
} from "./inventory.validation.js";

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

export const listInventoryRequestsController = asyncHandler(async (_req, res) => {
  const requests = await listInventoryRequests();
  res.json({ requests });
});

export const listInventoryStockController = asyncHandler(async (_req, res) => {
  const stockItems = await listInventoryStock();
  res.json({ stockItems });
});

export const createStockItemController = asyncHandler(async (req, res) => {
  const payload = parseCreateStockItemPayload(req.body);
  const stockItem = await createStockItem(payload);

  res.status(201).json({ stockItem });
});

export const getInventoryDashboardController = asyncHandler(async (_req, res) => {
  const dashboard = await getInventoryDashboard();
  res.json({ dashboard });
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
