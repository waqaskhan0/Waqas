import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import {
  createFinanceMatch,
  generatePayroll,
  listFinanceQueue,
  listPaymentHistory,
  listPayroll,
  listPendingPayments,
  markPayrollPaid,
  releasePoPayment,
  updatePayrollEntry
} from "./finance.service.js";
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

export const listPendingPaymentsController = asyncHandler(async (_req, res) => {
  const payments = await listPendingPayments();
  res.json({ payments });
});

export const listPaymentHistoryController = asyncHandler(async (_req, res) => {
  const payments = await listPaymentHistory();
  res.json({ payments });
});

export const releasePoPaymentController = asyncHandler(async (req, res) => {
  const purchaseOrderId = Number(req.params.id);

  if (!Number.isInteger(purchaseOrderId) || purchaseOrderId <= 0) {
    throw new ApiError(400, "A valid purchase order id is required.");
  }

  const payment = await releasePoPayment(req.user, purchaseOrderId, req.body);
  res.json({ payment });
});

export const listPayrollController = asyncHandler(async (req, res) => {
  const payroll = await listPayroll(req.query);
  res.json({ payroll });
});

export const generatePayrollController = asyncHandler(async (req, res) => {
  const payroll = await generatePayroll(req.body);
  res.status(201).json({ payroll });
});

export const updatePayrollController = asyncHandler(async (req, res) => {
  const payrollId = Number(req.params.id);

  if (!Number.isInteger(payrollId) || payrollId <= 0) {
    throw new ApiError(400, "A valid payroll id is required.");
  }

  const payroll = await updatePayrollEntry(payrollId, req.body);
  res.json({ payroll });
});

export const markPayrollPaidController = asyncHandler(async (req, res) => {
  const payrollId = Number(req.params.id);

  if (!Number.isInteger(payrollId) || payrollId <= 0) {
    throw new ApiError(400, "A valid payroll id is required.");
  }

  const payroll = await markPayrollPaid(payrollId);
  res.json({ payroll });
});
