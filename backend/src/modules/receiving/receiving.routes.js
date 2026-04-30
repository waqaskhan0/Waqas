import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  listReceivingQueueController,
  receivePurchaseOrderController
} from "./receiving.controller.js";

export const receivingRouter = Router();

receivingRouter.use(authenticate, authorizeRoles(ROLES.INVENTORY_OFFICER, ROLES.SUPER_ADMIN));
receivingRouter.get("/queue", listReceivingQueueController);
receivingRouter.post("/purchase-orders/:id/receive", receivePurchaseOrderController);
