import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  createPurchaseOrderController,
  listProcurementQueueController,
  listVendorsController
} from "./procurement.controller.js";

export const procurementRouter = Router();

procurementRouter.use(authenticate, authorizeRoles(ROLES.PROCUREMENT_OFFICER));
procurementRouter.get("/queue", listProcurementQueueController);
procurementRouter.get("/vendors", listVendorsController);
procurementRouter.post("/requisitions/:id/purchase-orders", createPurchaseOrderController);
