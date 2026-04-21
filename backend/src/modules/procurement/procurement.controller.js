import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createPurchaseOrder,
  listProcurementQueue,
  listVendors
} from "./procurement.service.js";
import { parseCreatePurchaseOrderPayload } from "./procurement.validation.js";

function parseRequisitionId(value) {
  const requisitionId = Number(value);

  if (!Number.isInteger(requisitionId) || requisitionId <= 0) {
    return null;
  }

  return requisitionId;
}

export const listProcurementQueueController = asyncHandler(async (_req, res) => {
  const requisitions = await listProcurementQueue();
  res.json({ requisitions });
});

export const listVendorsController = asyncHandler(async (_req, res) => {
  const vendors = await listVendors();
  res.json({ vendors });
});

export const createPurchaseOrderController = asyncHandler(async (req, res) => {
  const requisitionId = parseRequisitionId(req.params.id);

  if (!requisitionId) {
    res.status(400).json({
      error: "A valid requisition id is required.",
      details: null
    });
    return;
  }

  const payload = parseCreatePurchaseOrderPayload(req.body);
  const result = await createPurchaseOrder(req.user, requisitionId, payload);

  res.status(201).json(result);
});
