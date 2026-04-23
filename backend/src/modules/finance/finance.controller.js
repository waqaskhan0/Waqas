import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { createFinanceMatch, listFinanceQueue } from "./finance.service.js";
import { parseCreateFinanceMatchPayload } from "./finance.validation.js";

export const listFinanceQueueController = asyncHandler(async (_req, res) => {
  const purchaseOrders = await listFinanceQueue();
  res.json({ purchaseOrders });
});

export const createFinanceMatchController = asyncHandler(async (req, res) => {
  const purchaseOrderId = Number(req.params.id);

  if (!Number.isInteger(purchaseOrderId) || purchaseOrderId <= 0) {
    throw new ApiError(400, "A valid purchase order id is required.");
  }

  const payload = parseCreateFinanceMatchPayload(req.body);
  const result = await createFinanceMatch(req.user, purchaseOrderId, payload);

  res.status(201).json(result);
});
