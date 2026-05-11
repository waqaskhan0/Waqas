import { Router } from "express";
import { ROLES } from "../../config/roles.js";
import { authenticate, authorizeRoles } from "../../middleware/auth.js";
import {
  createStockItemController,
<<<<<<< HEAD
  getInventoryDashboardController,
  listInventoryQueueController,
  listInventoryRequestsController,
=======
  listInventoryTransactionsController,
  listInventoryQueueController,
  listLowStockItemsController,
>>>>>>> c1f5b2bc2d3fd00af2134e2513677df888304388
  listInventoryStockController,
  processInventoryDecisionController,
  stockInController,
  updateStockItemController
} from "./inventory.controller.js";

export const inventoryRouter = Router();

<<<<<<< HEAD
inventoryRouter.use(authenticate, authorizeRoles(ROLES.INVENTORY_OFFICER));
inventoryRouter.get("/dashboard", getInventoryDashboardController);
inventoryRouter.get("/requests", listInventoryRequestsController);
inventoryRouter.get("/queue", listInventoryQueueController);
inventoryRouter.get("/stock", listInventoryStockController);
inventoryRouter.post("/stock", createStockItemController);
=======
inventoryRouter.use(authenticate, authorizeRoles(ROLES.INVENTORY_OFFICER, ROLES.SUPER_ADMIN));
inventoryRouter.get("/queue", listInventoryQueueController);
inventoryRouter.get("/stock", listInventoryStockController);
inventoryRouter.get("/", listInventoryStockController);
inventoryRouter.post("/", createStockItemController);
inventoryRouter.put("/:id", updateStockItemController);
inventoryRouter.post("/stock-in", stockInController);
inventoryRouter.get("/low-stock", listLowStockItemsController);
inventoryRouter.get("/transactions", listInventoryTransactionsController);
>>>>>>> c1f5b2bc2d3fd00af2134e2513677df888304388
inventoryRouter.post("/requisitions/:id/process", processInventoryDecisionController);
