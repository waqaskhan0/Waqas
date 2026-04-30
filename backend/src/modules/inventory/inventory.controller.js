import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createStockItem,
  listInventoryTransactions,
  listInventoryQueue,
  listLowStockItems,
  listInventoryStock,
  processInventoryDecision,
  stockIn,
  updateStockItem
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

export const createStockItemController = asyncHandler(async (req, res) => {
  const stockItem = await createStockItem(req.body);
  res.status(201).json({ stockItem });
});

export const updateStockItemController = asyncHandler(async (req, res) => {
  const stockItemId = Number(req.params.id);

  if (!Number.isInteger(stockItemId) || stockItemId <= 0) {
    res.status(400).json({
      error: "A valid stock item id is required.",
      details: null
    });
    return;
  }

  const stockItem = await updateStockItem(stockItemId, req.body);
  res.json({ stockItem });
});

export const stockInController = asyncHandler(async (req, res) => {
  const stockItem = await stockIn(req.user, req.body);
  res.json({ stockItem });
});

export const listLowStockItemsController = asyncHandler(async (_req, res) => {
  const stockItems = await listLowStockItems();
  res.json({ stockItems });
});

export const listInventoryTransactionsController = asyncHandler(async (req, res) => {
  const transactions = await listInventoryTransactions(req.query);
  res.json({ transactions });
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
