import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createVendor,
  createPurchaseOrder,
  deactivateVendor,
  listGoodsReceipts,
  listPurchaseOrders,
  listProcurementQueue,
  listVendors,
  updatePurchaseOrderStatus,
  updateVendor
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

export const createVendorController = asyncHandler(async (req, res) => {
  const vendor = await createVendor(req.body);
  res.status(201).json({ vendor });
});

export const updateVendorController = asyncHandler(async (req, res) => {
  const vendorId = parseRequisitionId(req.params.id);

  if (!vendorId) {
    res.status(400).json({
      error: "A valid vendor id is required.",
      details: null
    });
    return;
  }

  const vendor = await updateVendor(vendorId, req.body);
  res.json({ vendor });
});

export const deactivateVendorController = asyncHandler(async (req, res) => {
  const vendorId = parseRequisitionId(req.params.id);

  if (!vendorId) {
    res.status(400).json({
      error: "A valid vendor id is required.",
      details: null
    });
    return;
  }

  await deactivateVendor(vendorId);
  res.json({ ok: true });
});

export const listPurchaseOrdersController = asyncHandler(async (_req, res) => {
  const purchaseOrders = await listPurchaseOrders();
  res.json({ purchaseOrders });
});

export const updatePurchaseOrderStatusController = asyncHandler(async (req, res) => {
  const purchaseOrderId = parseRequisitionId(req.params.id);

  if (!purchaseOrderId) {
    res.status(400).json({
      error: "A valid purchase order id is required.",
      details: null
    });
    return;
  }

  await updatePurchaseOrderStatus(purchaseOrderId, req.body.status);
  res.json({ ok: true });
});

export const listGoodsReceiptsController = asyncHandler(async (_req, res) => {
  const goodsReceipts = await listGoodsReceipts();
  res.json({ goodsReceipts });
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
