import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  listInventoryQueueController,
  listInventoryStockController,
  processInventoryDecisionController
} from "./inventory.controller.js";

export const inventoryRouter = Router();

inventoryRouter.use(authenticate, authorizeRoles(ROLES.INVENTORY_OFFICER));
inventoryRouter.get("/queue", listInventoryQueueController);
inventoryRouter.get("/stock", listInventoryStockController);
inventoryRouter.post("/requisitions/:id/process", processInventoryDecisionController);
