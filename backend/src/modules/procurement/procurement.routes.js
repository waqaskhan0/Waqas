import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  createVendorController,
  createPurchaseOrderController,
  deactivateVendorController,
  listGoodsReceiptsController,
  listPurchaseOrdersController,
  listProcurementQueueController,
  listVendorsController,
  updatePurchaseOrderStatusController,
  updateVendorController
} from "./procurement.controller.js";

export const procurementRouter = Router();

procurementRouter.use(authenticate, authorizeRoles(ROLES.PROCUREMENT_OFFICER, ROLES.SUPER_ADMIN));
procurementRouter.get("/queue", listProcurementQueueController);
procurementRouter.get("/vendors", listVendorsController);
procurementRouter.post("/vendors", createVendorController);
procurementRouter.put("/vendors/:id", updateVendorController);
procurementRouter.patch("/vendors/:id/deactivate", deactivateVendorController);
procurementRouter.get("/purchase-orders", listPurchaseOrdersController);
procurementRouter.patch("/purchase-orders/:id/status", updatePurchaseOrderStatusController);
procurementRouter.get("/grn", listGoodsReceiptsController);
procurementRouter.post("/requisitions/:id/purchase-orders", createPurchaseOrderController);
