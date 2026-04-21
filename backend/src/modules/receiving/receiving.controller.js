import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  listReceivingQueue,
  receivePurchaseOrder
} from "./receiving.service.js";
import { parseReceivePurchaseOrderPayload } from "./receiving.validation.js";

function parsePurchaseOrderId(value) {
  const purchaseOrderId = Number(value);

  if (!Number.isInteger(purchaseOrderId) || purchaseOrderId <= 0) {
    return null;
  }

  return purchaseOrderId;
}

export const listReceivingQueueController = asyncHandler(async (_req, res) => {
  const purchaseOrders = await listReceivingQueue();
  res.json({ purchaseOrders });
});

export const receivePurchaseOrderController = asyncHandler(async (req, res) => {
  const purchaseOrderId = parsePurchaseOrderId(req.params.id);

  if (!purchaseOrderId) {
    res.status(400).json({
      error: "A valid purchase order id is required.",
      details: null
    });
    return;
  }

  const payload = parseReceivePurchaseOrderPayload(req.body);
  const result = await receivePurchaseOrder(req.user, purchaseOrderId, payload);

  res.status(201).json(result);
});
