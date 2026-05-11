import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  createFinanceMatchController,
  generatePayrollController,
  listFinanceQueueController,
  listPaymentHistoryController,
  listPayrollController,
  listPendingPaymentsController,
  markPayrollPaidController,
  releasePoPaymentController,
  updatePayrollController
} from "./finance.controller.js";

export const financeRouter = Router();

financeRouter.use(authenticate, authorizeRoles(ROLES.FINANCE, ROLES.SUPER_ADMIN));
financeRouter.get("/queue", listFinanceQueueController);
financeRouter.get("/pending-payments", listPendingPaymentsController);
financeRouter.get("/payment-history", listPaymentHistoryController);
financeRouter.patch("/po/:id/pay", releasePoPaymentController);
financeRouter.post("/purchase-orders/:id/match", createFinanceMatchController);
financeRouter.get("/payroll", listPayrollController);
financeRouter.post("/payroll/generate", generatePayrollController);
financeRouter.patch("/payroll/:id", updatePayrollController);
financeRouter.patch("/payroll/:id/paid", markPayrollPaidController);
