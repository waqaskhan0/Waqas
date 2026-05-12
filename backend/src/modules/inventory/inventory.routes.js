import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  createStockItemAliasController,
  createStockItemController,
  getInventoryDashboardController,
  listInventoryQueueController,
  listInventoryRequestsController,
  listInventoryTransactionsController,
  listLowStockItemsController,
  listInventoryStockController,
  processInventoryDecisionController,
  stockInController,
  updateStockItemController
} from "./inventory.controller.js";

export const inventoryRouter = Router();

inventoryRouter.use(authenticate, authorizeRoles(ROLES.INVENTORY_OFFICER, ROLES.SUPER_ADMIN));
inventoryRouter.get("/dashboard", getInventoryDashboardController);
inventoryRouter.get("/requests", listInventoryRequestsController);
inventoryRouter.get("/queue", listInventoryQueueController);
inventoryRouter.get("/stock", listInventoryStockController);
inventoryRouter.post("/stock", createStockItemController);
inventoryRouter.get("/", listInventoryStockController);
inventoryRouter.post("/", createStockItemAliasController);
inventoryRouter.put("/:id", updateStockItemController);
inventoryRouter.post("/stock-in", stockInController);
inventoryRouter.get("/low-stock", listLowStockItemsController);
inventoryRouter.get("/transactions", listInventoryTransactionsController);
inventoryRouter.post("/requisitions/:id/process", processInventoryDecisionController);
